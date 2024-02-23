import { Proof } from "@iden3/js-merkletree";
import { Claim, toLittleEndian } from "@iden3/js-iden3-core";
import { poseidon, PrivateKey, PublicKey } from "@iden3/js-crypto";

import { NodeAuxValue } from "@/test/helpers/iden3/types";

import { AuthClaimFromPubKey } from "@/test/helpers/iden3/claim-templates";
import { Identity, RegistrationDocument } from "@/test/helpers";
import { deepClone } from "@scripts";

export function NewAuthClaim(privKHex: string): [Claim, PrivateKey] {
  // extract pubKey
  const [key, publicKey] = ExtractPubXY(privKHex);
  // create auth claim
  return [AuthClaimFromPubKey(publicKey), key];
}

export function ExtractPubXY(privKHex: string): [PrivateKey, PublicKey] {
  if (privKHex[1] !== "x") {
    privKHex = "0x" + privKHex;
  }

  const pk = new PrivateKey(bigIntToUint8Array(BigInt(privKHex)));

  return [pk, pk.public()];
}

export function bigIntToUint8Array(bigintValue: bigint, outputByteSize = 32) {
  return toLittleEndian(bigintValue, outputByteSize);
}

export function PrepareProof(proof: Proof, levels: number): [bigint[], NodeAuxValue] {
  return [
    PrepareSiblingsStr(
      proof.allSiblings().map((sibling) => sibling.bigInt()),
      levels,
    ),
    getNodeAuxValue(proof),
  ];
}

export function PrepareSiblingsStr(siblings: bigint[], levels: number): bigint[] {
  // Add the rest of empty levels to the siblings
  for (let i = siblings.length; i < levels; i++) {
    siblings.push(0n);
  }
  return siblings.map((sibling) => sibling);
}

export function prepareValue(value: bigint[], levels: number): bigint[] {
  // Add the rest of empty levels to the value
  for (let i = value.length; i < levels; i++) {
    value.push(0n);
  }
  return value;
}

export function getNodeAuxValue(proof: Proof): NodeAuxValue {
  // proof of inclusion
  if (proof.existence) {
    return {
      key: 0n,
      value: 0n,
      noAux: 0n,
    };
  }

  // proof of non-inclusion (NodeAux exists)
  if (proof.nodeAux) {
    return {
      key: proof.nodeAux.key.bigInt(),
      value: proof.nodeAux.value.bigInt(),
      noAux: 0n,
    };
  }
  // proof of non-inclusion (NodeAux does not exist)
  return {
    key: 0n,
    value: 0n,
    noAux: 1n,
  };
}

const BatchSize = 5;

export function poseidonHashValue(values: bigint[]): bigint {
  let iterationCount = 0;

  const getValueByIndex = (arr: bigint[], idx: number, length: number): bigint => {
    if (idx < length) {
      return arr[idx];
    }
    return 0n;
  };

  const hashFnBatchSize = 6;
  const l = values.length;

  let fullHash = poseidon.hash([
    getValueByIndex(values, 0, l),
    getValueByIndex(values, 1, l),
    getValueByIndex(values, 2, l),
    getValueByIndex(values, 3, l),
    getValueByIndex(values, 4, l),
    getValueByIndex(values, 5, l),
  ]);

  const restLength = l - hashFnBatchSize;
  if (restLength > BatchSize) {
    const r = restLength % BatchSize;
    const diff = BatchSize - r;
    iterationCount = (restLength + diff) / BatchSize;
  }

  for (let i = 0; i < iterationCount; i++) {
    const elemIdx = i * BatchSize + hashFnBatchSize;
    fullHash = poseidon.hash([
      fullHash,
      getValueByIndex(values, elemIdx, l),
      getValueByIndex(values, elemIdx + 1, l),
      getValueByIndex(values, elemIdx + 2, l),
      getValueByIndex(values, elemIdx + 3, l),
      getValueByIndex(values, elemIdx + 4, l),
    ]);
  }

  return fullHash;
}

export function setUpRegistrationDocument(
  user: Identity,
  issuer: Identity,
  issuingAuthority: bigint,
  documentNullifier: bigint,
): string {
  const document = deepClone(RegistrationDocument);

  document.issuer = issuer.id.string();
  document.credentialSubject.id = user.id.string();
  document.credentialSubject.documentNullifier = documentNullifier.toString();
  document.credentialSubject.issuingAuthority = issuingAuthority;
  document.credentialSubject.credentialHash = poseidon.hash([1n, issuingAuthority, documentNullifier]);
  document.credentialSubject.isAdult = true;

  return JSON.stringify(document);
}

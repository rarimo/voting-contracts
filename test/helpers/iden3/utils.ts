import { Proof } from "@iden3/js-merkletree";
import { Claim } from "@iden3/js-iden3-core";
import { PrivateKey, PublicKey } from "@iden3/js-crypto";

import { NodeAuxValue } from "@/test/helpers/iden3/types";

import { AuthClaimFromPubKey } from "@/test/helpers/iden3/claim-templates";

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
  const result = new Uint8Array(outputByteSize);
  let tempValue = bigintValue;

  for (let i = 0; i < outputByteSize; i++) {
    // Extract the least significant byte of the current BigInt value
    result[i] = Number(tempValue & BigInt(0xff));
    // Shift right by 8 bits for the next iteration
    tempValue >>= 8n;
  }

  return result;
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

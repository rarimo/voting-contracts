import { DID, SchemaHash } from "@iden3/js-iden3-core";
import { Merklizer, Path } from "@iden3/js-jsonld-merklization";
import { LocalStorageDB, Merkletree, str2Bytes } from "@iden3/js-merkletree";

import { REGISTRATION_CLAIM_SCHEMA_ID } from "@scripts";

import {
  timestamp,
  requestID,
  ClaimLevels,
  OnChainLevels,
  PrepareProof,
  prepareValue,
  DefaultJSONUserClaim,
  Operator,
  CredentialAtomicMTPOnChainV2Outputs,
  CredentialAtomicMTPOnChainV2Inputs,
  poseidonHashValue,
  RegistrationUserClaim,
  ValueArraySize,
} from "@/test/helpers";

import { Identity } from "@/test/helpers/iden3/identity";

export async function generateMTPData(
  user: Identity,
  issuer: Identity,
  mz: Merklizer,
  gistData: { id: bigint; state: bigint }[],
  claimSalt = 0n,
): Promise<[CredentialAtomicMTPOnChainV2Inputs, CredentialAtomicMTPOnChainV2Outputs]> {
  const schemaHash = SchemaHash.newSchemaHashFromInt(REGISTRATION_CLAIM_SCHEMA_ID);

  const claim = await DefaultJSONUserClaim(user.id, schemaHash, mz, claimSalt);

  const path = Path.newPath([
    "https://www.w3.org/2018/credentials#credentialSubject",
    "https://w3id.org/citizenship#residentSince",
  ]);

  const jsonP = await mz.proof(path);
  const value = jsonP.value!;

  const valueKey = await value.mtEntry();

  const [claimJSONLDProof, claimJSONLDProofAux] = PrepareProof(jsonP.proof, ClaimLevels);

  const pathKey = await path.mtEntry();

  await issuer.addClaim(claim);

  const issuerClaimMtp = await issuer.claimMTP(claim);

  const [issuerClaimNonRevMtp, issuerClaimNonRevAux] = await issuer.claimRevMTP(claim);

  let challenge = BigInt(12345);

  const gistTree = new Merkletree(new LocalStorageDB(str2Bytes("gist-tree")), true, OnChainLevels);
  if ((await gistTree.root()).bigInt() === 0n) {
    await gistTree.add(await issuer.idHash(), await issuer.state());
  }

  for (const data of gistData) {
    await gistTree.add(data.id, data.state);
  }

  const authMTProof = await user.authMTPProofSiblings();
  const [authNonRevMTProof, nodeAuxNonRev] = await user.claimRevMTP(user.authClaim);

  const sig = await user.sign(challenge);

  const gistProofRaw = await gistTree.generateProof(await user.idHash());
  const gistRoot = await gistTree.root();

  const [gistProof, gistNodAux] = PrepareProof(gistProofRaw.proof, OnChainLevels);

  const inputs: CredentialAtomicMTPOnChainV2Inputs = {
    requestID: requestID,
    // User data
    userGenesisID: DID.idFromDID(user.id).bigInt(),
    profileNonce: 0n,
    claimSubjectProfileNonce: 0n,
    userAuthClaim: user.authClaim,
    userAuthClaimMtp: authMTProof,
    userAuthClaimNonRevMtp: authNonRevMTProof,
    userAuthClaimNonRevMtpAuxHi: nodeAuxNonRev.key,
    userAuthClaimNonRevMtpAuxHv: nodeAuxNonRev.value,
    userAuthClaimNonRevMtpNoAux: nodeAuxNonRev.noAux,
    challenge: challenge,
    challengeSignatureR8X: sig.R8[0],
    challengeSignatureR8Y: sig.R8[1],
    challengeSignatureS: sig.S,
    userClaimsTreeRoot: (await user.claimTree.root()).bigInt(),
    userRevTreeRoot: (await user.revTree.root()).bigInt(),
    userRootsTreeRoot: (await user.rootsTree.root()).bigInt(),
    userState: await user.state(),
    gistRoot: gistRoot.bigInt(),
    gistMtp: gistProof,
    gistMtpAuxHi: gistNodAux.key,
    gistMtpAuxHv: gistNodAux.value,
    gistMtpNoAux: gistNodAux.noAux,
    // end user data
    issuerID: DID.idFromDID(issuer.id).bigInt(),
    // Claim
    issuerClaim: claim,
    issuerClaimMtp: issuerClaimMtp[0],
    issuerClaimClaimsTreeRoot: (await issuer.claimTree.root()).bigInt(),
    issuerClaimRevTreeRoot: (await issuer.revTree.root()).bigInt(),
    issuerClaimRootsTreeRoot: (await issuer.rootsTree.root()).bigInt(),
    issuerClaimIdenState: await issuer.state(),

    isRevocationChecked: 1,
    issuerClaimNonRevClaimsTreeRoot: (await issuer.claimTree.root()).bigInt(),
    issuerClaimNonRevRevTreeRoot: (await issuer.revTree.root()).bigInt(),
    issuerClaimNonRevRootsTreeRoot: (await issuer.rootsTree.root()).bigInt(),
    issuerClaimNonRevState: await issuer.state(),
    issuerClaimNonRevMtp: issuerClaimNonRevMtp,
    issuerClaimNonRevMtpAuxHi: issuerClaimNonRevAux.key,
    issuerClaimNonRevMtpAuxHv: issuerClaimNonRevAux.value,
    issuerClaimNonRevMtpNoAux: issuerClaimNonRevAux.noAux,

    claimSchema: schemaHash.bigInt(),

    // Query
    // JSON path
    claimPathNotExists: 0n, // 0 for inclusion, 1 for non-inclusion
    claimPathMtp: claimJSONLDProof,
    claimPathMtpNoAux: claimJSONLDProofAux.noAux, // 1 if aux node is empty, 0 if non-empty or for inclusion proofs
    claimPathMtpAuxHi: claimJSONLDProofAux.key, // 0 for inclusion proof
    claimPathMtpAuxHv: claimJSONLDProofAux.value, // 0 for inclusion proof
    claimPathKey: pathKey, // hash of path in merklized json-ld document
    claimPathValue: valueKey, // value in this path in merklized json-ld document

    operator: Operator.EQ,
    slotIndex: 0,
    timestamp: timestamp,
    value: prepareValue([valueKey], ValueArraySize),
  };

  const valuesHash = poseidonHashValue(inputs.value);
  const claimSchemaInt = BigInt(schemaHash.bigInt());
  const circuitQueryHash = poseidonHashValue([
    claimSchemaInt,
    BigInt(inputs.slotIndex),
    BigInt(inputs.operator),
    pathKey,
    0n,
    valuesHash,
  ]);

  const out: CredentialAtomicMTPOnChainV2Outputs = {
    requestID: requestID,
    userID: 0n,
    issuerID: DID.idFromDID(issuer.id).bigInt(),
    issuerClaimIdenState: await issuer.state(),
    issuerClaimNonRevState: await issuer.state(),
    circuitQueryHash: circuitQueryHash,
    timestamp: timestamp,
    merklized: 1n,
    challenge: challenge,
    gistRoot: gistRoot.bigInt(),
    isRevocationChecked: 1n,
  };

  return [inputs, out];
}

export async function generateRegistrationData(
  user: Identity,
  issuer: Identity,
  mz: Merklizer,
  claimSalt = 0n,
): Promise<[CredentialAtomicMTPOnChainV2Inputs, CredentialAtomicMTPOnChainV2Outputs]> {
  const schemaHash = SchemaHash.newSchemaHashFromInt(REGISTRATION_CLAIM_SCHEMA_ID);

  const claim = await RegistrationUserClaim(user.id, schemaHash, mz, claimSalt);

  const path = Path.newPath((await mz.resolveDocPath("credentialSubject.credentialHash")).parts);

  const jsonP = await mz.proof(path);

  const value = jsonP.value!;

  const valueKey = await value.mtEntry();

  const [claimJSONLDProof, claimJSONLDProofAux] = PrepareProof(jsonP.proof, ClaimLevels);

  const pathKey = await path.mtEntry();

  await issuer.addClaim(claim);

  const issuerClaimMtp = await issuer.claimMTP(claim);

  const [issuerClaimNonRevMtp, issuerClaimNonRevAux] = await issuer.claimRevMTP(claim);

  const gistTree = new Merkletree(new LocalStorageDB(str2Bytes("gist-tree")), true, OnChainLevels);
  if ((await gistTree.root()).bigInt() === 0n) {
    await gistTree.add(await issuer.idHash(), await issuer.state());
  }

  const authMTProof = await user.authMTPProofSiblings();
  const [authNonRevMTProof, nodeAuxNonRev] = await user.claimRevMTP(user.authClaim);

  let challenge = BigInt(12345);
  const sig = await user.sign(challenge);

  const gistProofRaw = await gistTree.generateProof(await user.idHash());
  const gistRoot = await gistTree.root();

  const [gistProof, gistNodAux] = PrepareProof(gistProofRaw.proof, OnChainLevels);

  const inputs: CredentialAtomicMTPOnChainV2Inputs = {
    requestID: requestID,
    // User data
    userGenesisID: DID.idFromDID(user.id).bigInt(),
    profileNonce: 0n,
    claimSubjectProfileNonce: 0n,
    userAuthClaim: user.authClaim,
    userAuthClaimMtp: authMTProof,
    userAuthClaimNonRevMtp: authNonRevMTProof,
    userAuthClaimNonRevMtpAuxHi: nodeAuxNonRev.key,
    userAuthClaimNonRevMtpAuxHv: nodeAuxNonRev.value,
    userAuthClaimNonRevMtpNoAux: nodeAuxNonRev.noAux,
    challenge: challenge,
    challengeSignatureR8X: sig.R8[0],
    challengeSignatureR8Y: sig.R8[1],
    challengeSignatureS: sig.S,
    userClaimsTreeRoot: (await user.claimTree.root()).bigInt(),
    userRevTreeRoot: (await user.revTree.root()).bigInt(),
    userRootsTreeRoot: (await user.rootsTree.root()).bigInt(),
    userState: await user.state(),
    gistRoot: gistRoot.bigInt(),
    gistMtp: gistProof,
    gistMtpAuxHi: gistNodAux.key,
    gistMtpAuxHv: gistNodAux.value,
    gistMtpNoAux: gistNodAux.noAux,
    // end user data
    issuerID: DID.idFromDID(issuer.id).bigInt(),
    // Claim
    issuerClaim: claim,
    issuerClaimMtp: issuerClaimMtp[0],
    issuerClaimClaimsTreeRoot: (await issuer.claimTree.root()).bigInt(),
    issuerClaimRevTreeRoot: (await issuer.revTree.root()).bigInt(),
    issuerClaimRootsTreeRoot: (await issuer.rootsTree.root()).bigInt(),
    issuerClaimIdenState: await issuer.state(),

    isRevocationChecked: 1,
    issuerClaimNonRevClaimsTreeRoot: (await issuer.claimTree.root()).bigInt(),
    issuerClaimNonRevRevTreeRoot: (await issuer.revTree.root()).bigInt(),
    issuerClaimNonRevRootsTreeRoot: (await issuer.rootsTree.root()).bigInt(),
    issuerClaimNonRevState: await issuer.state(),
    issuerClaimNonRevMtp: issuerClaimNonRevMtp,
    issuerClaimNonRevMtpAuxHi: issuerClaimNonRevAux.key,
    issuerClaimNonRevMtpAuxHv: issuerClaimNonRevAux.value,
    issuerClaimNonRevMtpNoAux: issuerClaimNonRevAux.noAux,

    claimSchema: schemaHash.bigInt(),

    // Query
    // JSON path
    claimPathNotExists: 0n, // 0 for inclusion, 1 for non-inclusion
    claimPathMtp: claimJSONLDProof,
    claimPathMtpNoAux: claimJSONLDProofAux.noAux, // 1 if aux node is empty, 0 if non-empty or for inclusion proofs
    claimPathMtpAuxHi: claimJSONLDProofAux.key, // 0 for inclusion proof
    claimPathMtpAuxHv: claimJSONLDProofAux.value, // 0 for inclusion proof
    claimPathKey: pathKey, // hash of path in merklized json-ld document
    claimPathValue: valueKey, // value in this path in merklized json-ld document

    operator: Operator.EQ,
    slotIndex: 0,
    timestamp: timestamp,
    value: prepareValue([valueKey], ValueArraySize),
  };

  const valuesHash = poseidonHashValue(inputs.value);
  const claimSchemaInt = BigInt(schemaHash.bigInt());
  const circuitQueryHash = poseidonHashValue([
    claimSchemaInt,
    BigInt(inputs.slotIndex),
    BigInt(inputs.operator),
    pathKey,
    0n,
    valuesHash,
  ]);

  const out: CredentialAtomicMTPOnChainV2Outputs = {
    requestID: requestID,
    userID: 0n,
    issuerID: DID.idFromDID(issuer.id).bigInt(),
    issuerClaimIdenState: await issuer.state(),
    issuerClaimNonRevState: await issuer.state(),
    circuitQueryHash: circuitQueryHash,
    timestamp: timestamp,
    merklized: 0n,
    challenge: challenge,
    gistRoot: gistRoot.bigInt(),
    isRevocationChecked: 1n,
  };

  return [inputs, out];
}

import { Path } from "@iden3/js-jsonld-merklization";
import { DID, SchemaHash } from "@iden3/js-iden3-core";
import { LocalStorageDB, Merkletree, str2Bytes } from "@iden3/js-merkletree";

import { Identity } from "@/test/helpers/iden3/identity";
import {
  UserPK,
  IssuerPK,
  timestamp,
  requestID,
  ClaimLevels,
  IssuerLevels,
  OnChainLevels,
  IDOwnershipLevels,
  PrepareProof,
  prepareValue,
  DefaultJSONUserClaim,
  Operator,
  CredentialAtomicMTPOnChainV2Outputs,
  CredentialAtomicMTPOnChainV2Inputs,
} from "@/test/helpers";

export async function generateMTPData(gistData: { id: bigint; state: bigint }[]): Promise<any> {
  const user = await new Identity(UserPK, IDOwnershipLevels, IDOwnershipLevels, IDOwnershipLevels).postBuild();
  const issuer = await new Identity(IssuerPK, IssuerLevels, IssuerLevels, IssuerLevels).postBuild();

  const schemaHash = SchemaHash.newSchemaHashFromInt(31584121850720233142680868736086212256n);

  const [claim, mz] = await DefaultJSONUserClaim(user.id, schemaHash);

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

  const gisTree = new Merkletree(new LocalStorageDB(str2Bytes("gist-tree")), true, OnChainLevels);

  for (const data of gistData) {
    await gisTree.add(data.id, data.state);
  }

  const authMTProof = await user.authMTPStrign();
  const [authNonRevMTProof, nodeAuxNonRev] = await user.claimRevMTP(user.authClaim);

  const sig = await user.sign(challenge);

  const gistProofRaw = await gisTree.generateProof(await user.IDHash());
  const gistRoot = await gisTree.root();

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
    value: prepareValue([valueKey], 64),
  };

  const out: CredentialAtomicMTPOnChainV2Outputs = {
    requestID: requestID,
    userID: 0n,
    issuerID: DID.idFromDID(issuer.id).bigInt(),
    issuerClaimIdenState: await issuer.state(),
    issuerClaimNonRevState: await issuer.state(),
    circuitQueryHash: 0n,
    timestamp: timestamp,
    merklized: 1n,
    challenge: challenge,
    gistRoot: gistRoot.bigInt(),
    isRevocationChecked: 1n,
  };

  return [inputs, out];
}

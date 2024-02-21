import { Claim } from "@iden3/js-iden3-core";

export interface StateTransitionInputs {
  authClaim: Claim;
  authClaimMtp: bigint[];
  authClaimNonRevMtp: bigint[];
  authClaimNonRevMtpAuxHi: bigint;
  authClaimNonRevMtpAuxHv: bigint;
  authClaimNonRevMtpNoAux: bigint;
  claimsTreeRoot: bigint;
  isOldStateGenesis: bigint;
  newUserState: bigint;
  oldUserState: bigint;
  revTreeRoot: bigint;
  rootsTreeRoot: bigint;
  signatureR8X: bigint;
  signatureR8Y: bigint;
  signatureS: bigint;
  userID: bigint;
  newAuthClaimMtp: bigint[];
  newClaimsTreeRoot: bigint;
  newRevTreeRoot: bigint;
  newRootsTreeRoot: bigint;
}

export interface StateTransitionOutputs {
  userID: bigint;
  newUserState: bigint;
  oldUserState: bigint;
  isOldStateGenesis: bigint;
}

export interface CredentialAtomicMTPOnChainV2Inputs {
  requestID: bigint;

  // User data
  userGenesisID: bigint;
  profileNonce: bigint;
  claimSubjectProfileNonce: bigint;
  userAuthClaim: Claim;
  userAuthClaimMtp: bigint[];
  userAuthClaimNonRevMtp: bigint[];
  userAuthClaimNonRevMtpAuxHi: bigint;
  userAuthClaimNonRevMtpAuxHv: bigint;
  userAuthClaimNonRevMtpNoAux: bigint;
  challenge: bigint;
  challengeSignatureR8X: bigint;
  challengeSignatureR8Y: bigint;
  challengeSignatureS: bigint;
  userClaimsTreeRoot: bigint;
  userRevTreeRoot: bigint;
  userRootsTreeRoot: bigint;
  userState: bigint;
  gistRoot: bigint;
  gistMtp: bigint[];
  gistMtpAuxHi: bigint;
  gistMtpAuxHv: bigint;
  gistMtpNoAux: bigint;
  // end user data

  issuerID: bigint;
  // Claim
  issuerClaim: Claim;
  // Inclusion
  issuerClaimMtp: bigint[];
  issuerClaimClaimsTreeRoot: bigint;
  issuerClaimRevTreeRoot: bigint;
  issuerClaimRootsTreeRoot: bigint;
  issuerClaimIdenState: bigint;

  isRevocationChecked: number;
  issuerClaimNonRevClaimsTreeRoot: bigint;
  issuerClaimNonRevRevTreeRoot: bigint;
  issuerClaimNonRevRootsTreeRoot: bigint;
  issuerClaimNonRevState: bigint;
  issuerClaimNonRevMtp: bigint[];
  issuerClaimNonRevMtpAuxHi: bigint;
  issuerClaimNonRevMtpAuxHv: bigint;
  issuerClaimNonRevMtpNoAux: bigint;

  claimSchema: bigint;

  // Query
  // JSON path
  claimPathNotExists: bigint; // 0 for inclusion, 1 for non-inclusion
  claimPathMtp: bigint[];
  claimPathMtpNoAux: bigint; // 1 if aux node is empty, 0 if non-empty or for inclusion proofs
  claimPathMtpAuxHi: bigint; // 0 for inclusion proof
  claimPathMtpAuxHv: bigint; // 0 for inclusion proof
  claimPathKey: bigint; // hash of path in merklized json-ld document
  claimPathValue: bigint; // value in this path in merklized json-ld document

  operator: number;
  slotIndex: number;
  timestamp: bigint;
  value: bigint[];
}

export interface CredentialAtomicMTPOnChainV2Outputs {
  merklized: bigint;
  userID: bigint;
  circuitQueryHash: bigint;
  requestID: bigint;
  issuerID: bigint;
  issuerClaimIdenState: bigint;
  issuerClaimNonRevState: bigint;
  timestamp: bigint;
  isRevocationChecked: bigint;
  gistRoot: bigint;
  challenge: bigint;
}

export interface GistData {
  id: bigint;
  state: bigint;
}

export interface NodeAuxValue {
  key: bigint;
  value: bigint;
  noAux: bigint;
}

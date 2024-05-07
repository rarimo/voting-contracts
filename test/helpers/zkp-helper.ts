// @ts-ignore
import * as snarkjs from "snarkjs";

import { ethers } from "hardhat";

import { poseidonHash } from "@/test/helpers/poseidon-hash";
import { CredentialAtomicMTPOnChainV2Inputs } from "@/test/helpers/iden3";

import { VerifierHelper } from "@/generated-types/contracts/core/Voting";

export interface SecretPair {
  secret: string;
  nullifier: string;
}

export function generateSecrets(): SecretPair {
  const secret = ethers.randomBytes(28);
  const nullifier = ethers.randomBytes(28);

  return {
    secret: padElement(ethers.hexlify(secret)),
    nullifier: padElement(ethers.hexlify(nullifier)),
  };
}

export function getCommitment(pair: SecretPair): string {
  return poseidonHash(pair.secret + pair.nullifier.replace("0x", ""));
}

export function getNullifierHash(pair: SecretPair): string {
  return poseidonHash(pair.nullifier);
}

export async function getRegisterZKP(
  inputs: CredentialAtomicMTPOnChainV2Inputs,
  votingAddress: string,
  commitment: string,
): Promise<[VerifierHelper.ProofPointsStruct, string[]]> {
  const data = await snarkjs.groth16.fullProve(
    {
      // we have no constraints for "requestID" in this circuit, it is used as a unique identifier for the request
      // and verifier can use it to identify the request, and verify the proof of specific request in case of multiple query requests
      requestID: inputs.requestID,
      /* userID ownership signals */
      userGenesisID: inputs.userGenesisID,
      profileNonce: inputs.profileNonce /* random number */,
      // user state
      userState: inputs.userState,
      userClaimsTreeRoot: inputs.userClaimsTreeRoot,
      userRevTreeRoot: inputs.userRevTreeRoot,
      userRootsTreeRoot: inputs.userRootsTreeRoot,
      // Auth claim
      authClaim: inputs.userAuthClaim.rawSlotsAsInts(),
      // auth claim. merkle tree proof of inclusion to claim tree
      authClaimIncMtp: inputs.userAuthClaimMtp,
      // auth claim - rev nonce. merkle tree proof of non-inclusion to rev tree
      authClaimNonRevMtp: inputs.userAuthClaimNonRevMtp,
      authClaimNonRevMtpNoAux: inputs.userAuthClaimNonRevMtpNoAux,
      authClaimNonRevMtpAuxHi: inputs.userAuthClaimNonRevMtpAuxHi,
      authClaimNonRevMtpAuxHv: inputs.userAuthClaimNonRevMtpAuxHv,
      // challenge signature
      challenge: inputs.challenge,
      challengeSignatureR8x: inputs.challengeSignatureR8X,
      challengeSignatureR8y: inputs.challengeSignatureR8Y,
      challengeSignatureS: inputs.challengeSignatureS,
      // global identity state tree on chain
      gistRoot: inputs.gistRoot,
      // proof of inclusion or exclusion of the user in the global state
      gistMtp: inputs.gistMtp,
      gistMtpAuxHi: inputs.gistMtpAuxHi,
      gistMtpAuxHv: inputs.gistMtpAuxHv,
      gistMtpNoAux: inputs.gistMtpNoAux,
      /* issuerClaim signals */
      claimSubjectProfileNonce: inputs.claimSubjectProfileNonce, // nonce of the profile that claim is issued to, 0 if claim is issued to genesisID
      // issuer ID
      issuerID: inputs.issuerID,
      /* issuerClaim signals */
      issuerClaim: inputs.issuerClaim.rawSlotsAsInts(),
      // issuer claim. merkle tree proof of inclusion to claim tree
      issuerClaimMtp: inputs.issuerClaimMtp,
      // global identity state tree on chain
      issuerClaimClaimsTreeRoot: inputs.issuerClaimClaimsTreeRoot,
      issuerClaimRevTreeRoot: inputs.issuerClaimRevTreeRoot,
      issuerClaimRootsTreeRoot: inputs.issuerClaimRootsTreeRoot,
      issuerClaimIdenState: inputs.issuerClaimIdenState,
      // issuerClaim non rev inputs
      isRevocationChecked: inputs.isRevocationChecked,
      issuerClaimNonRevMtp: inputs.issuerClaimNonRevMtp,
      issuerClaimNonRevMtpNoAux: inputs.issuerClaimNonRevMtpNoAux,
      issuerClaimNonRevMtpAuxHi: inputs.issuerClaimNonRevMtpAuxHi,
      issuerClaimNonRevMtpAuxHv: inputs.issuerClaimNonRevMtpAuxHv,
      issuerClaimNonRevClaimsTreeRoot: inputs.issuerClaimNonRevClaimsTreeRoot,
      issuerClaimNonRevRevTreeRoot: inputs.issuerClaimNonRevRevTreeRoot,
      issuerClaimNonRevRootsTreeRoot: inputs.issuerClaimNonRevRootsTreeRoot,
      issuerClaimNonRevState: inputs.issuerClaimNonRevState,
      /* current time */
      timestamp: inputs.timestamp,
      /** Query */
      claimSchema: inputs.claimSchema,
      claimPathNotExists: inputs.claimPathNotExists, // 0 for inclusion, 1 for non-inclusion
      claimPathMtp: inputs.claimPathMtp,
      claimPathMtpNoAux: inputs.claimPathMtpNoAux, // 1 if aux node is empty, 0 if non-empty or for inclusion proofs
      claimPathMtpAuxHi: inputs.claimPathMtpAuxHi, // 0 for inclusion proof
      claimPathMtpAuxHv: inputs.claimPathMtpAuxHv, // 0 for inclusion proof
      claimPathKey: inputs.claimPathKey, // hash of path in merklized json-ld document
      claimPathValue: inputs.claimPathValue, // value in this path in merklized json-ld document
      slotIndex: inputs.slotIndex,
      operator: inputs.operator,
      value: inputs.value,
      // Bindings for voting
      // Are not part of any computation within the circuit
      votingAddress: votingAddress,
      commitment: commitment,
    },
    `./test/circuits/registration.wasm`,
    `./test/circuits/registration.zkey`,
  );

  swap(data.proof.pi_b[0], 0, 1);
  swap(data.proof.pi_b[1], 0, 1);

  const formattedProof: VerifierHelper.ProofPointsStruct = {
    a: data.proof.pi_a.slice(0, 2).map((x: any) => padElement(BigInt(x))),
    b: data.proof.pi_b.slice(0, 2).map((x: any[]) => x.map((y: any) => padElement(BigInt(y)))),
    c: data.proof.pi_c.slice(0, 2).map((x: any) => padElement(BigInt(x))),
  };

  return [formattedProof, data.publicSignals];
}

export async function getVoteZKP(
  pair: SecretPair,
  root: string,
  vote: string,
  votingAddress: string,
  siblings: string[],
) {
  const nullifierHash = getNullifierHash(pair);

  const { proof } = await snarkjs.groth16.fullProve(
    {
      root: BigInt(root),
      vote,
      votingAddress,
      secret: pair.secret,
      nullifier: pair.nullifier,
      siblings,
    },
    `./test/circuits/voting.wasm`,
    `./test/circuits/voting.zkey`,
  );

  swap(proof.pi_b[0], 0, 1);
  swap(proof.pi_b[1], 0, 1);

  const formattedProof: VerifierHelper.ProofPointsStruct = {
    a: proof.pi_a.slice(0, 2).map((x: any) => padElement(BigInt(x))),
    b: proof.pi_b.slice(0, 2).map((x: any[]) => x.map((y: any) => padElement(BigInt(y)))),
    c: proof.pi_c.slice(0, 2).map((x: any) => padElement(BigInt(x))),
  };

  return {
    formattedProof,
    nullifierHash,
  };
}

// Function to swap two elements in an array
function swap(arr: any, i: number, j: number) {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

function padElement(element: any) {
  return ethers.toBeHex(element, 32);
}

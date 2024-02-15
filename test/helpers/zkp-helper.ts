// @ts-ignore
import * as snarkjs from "snarkjs";

import { ethers } from "hardhat";

import { poseidonHash } from "@/test/helpers/poseidon-hash";

import { VerifierHelper } from "@/generated-types/contracts/Voting";

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

export async function getZKP(pair: SecretPair, root: string, vote: string, votingAddress: string, siblings: string[]) {
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

export async function getPreImageZKP(pair: SecretPair) {
  const { proof } = await snarkjs.groth16.fullProve(
    {
      secret: pair.secret,
      nullifier: pair.nullifier,
    },
    `./test/circuits/poseidon.wasm`,
    `./test/circuits/poseidon.zkey`,
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
  };
}

export function checkMerkleProof(leaf: string, pathIndices: number[], pathElements: string[], _root: string) {
  for (let i = 0; i < pathIndices.length; i++) {
    const pathElement = pathElements[i];
    const pathIndex = pathIndices[i];

    if (pathIndex === 0) {
      leaf = poseidonHash(pathElement + leaf.replace("0x", ""));
    } else {
      leaf = poseidonHash(leaf + pathElement.replace("0x", ""));
    }
  }

  console.log(leaf);
  console.log(_root);
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

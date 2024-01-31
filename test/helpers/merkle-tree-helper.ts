import { ethers } from "hardhat";

import { MerkleTree } from "merkletreejs";

import { poseidonHash } from "@/test/helpers/poseidon-hash";

export function getRoot(tree: MerkleTree): string {
  const root = tree.getRoot();

  if (root.length == 0) {
    return ethers.ZeroHash;
  }

  return "0x" + root.toString("hex");
}

export function getProof(tree: MerkleTree, leaf: any): string[] {
  return tree.getProof(ethers.keccak256(leaf)).map((e) => "0x" + e.data.toString("hex"));
}

export function buildTree(leaves: any): MerkleTree {
  return new MerkleTree(leaves, ethers.keccak256, { hashLeaves: true, sortPairs: true });
}

export function buildSparseMerkleTree(hashFn: any, leaves: any, height: bigint): MerkleTree {
  const elementsToAdd = 2 ** Number(height) - leaves.length;
  const zeroHash = hashFn(ethers.ZeroHash);
  const zeroElements = Array(elementsToAdd).fill(zeroHash);

  return new MerkleTree([...leaves, ...zeroElements], hashFn, {
    hashLeaves: false,
    sortPairs: false,
  });
}

export function addElementToTree(tree: MerkleTree, element: any) {
  return new MerkleTree([...tree.getLeaves(), element], ethers.keccak256, {
    hashLeaves: true,
    sortPairs: true,
  });
}

export function getBytes32ElementHash(element: string) {
  return ethers.keccak256(ethers.toBeHex(element, 32));
}

export function getBytes32PoseidonHash(element: string) {
  return poseidonHash(ethers.toBeHex(element, 32));
}

export function getPositionalProof(tree: MerkleTree, leaf: string): [number[], string[]] {
  const positionalProof = tree.getPositionalHexProof(leaf);
  const positions = positionalProof.map((e) => Number(e[0]));
  const data = positionalProof.map((e) => ethers.toBeHex(ethers.hexlify(e[1] as any), 32));
  return [positions, data];
}

export const getLeafIndex = (tree: MerkleTree, leaf: string) => {
  return tree.getLeafIndex(Buffer.from(leaf.replace("0x", ""), "hex"));
};

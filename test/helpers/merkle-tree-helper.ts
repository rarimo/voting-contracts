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

function getZeroHashes(hashFn: any, height: number): string[] {
  let zeroHashes: string[] = new Array(height);

  zeroHashes[0] = hashFn(ethers.ZeroHash);

  for (let i = 1; i < height; ++i) {
    let prevHash = zeroHashes[i - 1];

    zeroHashes[i] = hashFn(prevHash + prevHash.replace("0x", ""));
  }

  return zeroHashes;
}

// Works only for fist 4 elements
export function getLazyProof(hashFn: any, leafIndex: number, leaves: string[], height: bigint): [number[], string[]] {
  const zeroHashes = getZeroHashes(hashFn, Number(height));
  let proofPositions: number[] = [];
  let proofHashes: string[] = [];

  let currentLevelLeaves = leaves;
  let currentIndex = leafIndex;

  for (let i = 0; i < height; i++) {
    const numLeavesAtLevel = Math.max(1, Math.ceil(currentLevelLeaves.length / Math.pow(2, i)));
    const isLeftNode = currentIndex % 2 === 0;
    const siblingIndex = isLeftNode ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < numLeavesAtLevel) {
      let siblingHash = currentLevelLeaves[siblingIndex];
      proofPositions.push(isLeftNode ? 0 : 1);
      proofHashes.push(siblingHash);
    } else {
      let siblingHash = zeroHashes[i];
      proofPositions.push(isLeftNode ? 0 : 1);
      proofHashes.push(siblingHash);
    }

    // Update current index for the next level
    currentIndex = Math.floor(currentIndex / 2);
    // Construct the next level of the tree
    if (i < height - 1n) {
      currentLevelLeaves = constructNextLevel(currentLevelLeaves, hashFn);
    }
  }

  return [proofPositions, proofHashes];
}

// Helper function to construct the next level of the tree
function constructNextLevel(leaves: string[], hashFn: any): string[] {
  let nextLevel = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i];
    const right = i + 1 < leaves.length ? leaves[i + 1] : left; // Duplicate if no sibling
    nextLevel.push(hashFn(left + right.replace("0x", "")));
  }
  return nextLevel;
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

import { ethers } from "hardhat";

import { SparseMerkleTree } from "@/generated-types/contracts/utils/PoseidonSMT";

import { Hash, Merkletree, Proof } from "@iden3/js-merkletree";

export async function getRoot(tree: Merkletree): Promise<string> {
  return ethers.toBeHex((await tree.root()).bigInt(), 32);
}

export function getOnchainProof(onchainProof: SparseMerkleTree.ProofStructOutput): Proof {
  const modifiableArray = JSON.parse(JSON.stringify(onchainProof.siblings)).reverse() as string[];
  const reversedKey = modifiableArray.findIndex((value) => value !== ethers.ZeroHash);
  const lastKey = reversedKey !== -1 ? onchainProof.siblings.length - 1 - reversedKey : -1;

  const siblings = onchainProof.siblings
    .filter((value: string, index: number) => value != ethers.ZeroHash || index <= lastKey)
    .map((sibling: string) => new Hash(Hash.fromHex(sibling.slice(2)).value.reverse()));

  let nodeAux: { key: Hash; value: Hash } | undefined = undefined;

  if (onchainProof.auxExistence) {
    nodeAux = {
      key: new Hash(Hash.fromHex(onchainProof.auxKey.slice(2)).value.reverse()),
      value: new Hash(Hash.fromHex(onchainProof.auxValue.slice(2)).value.reverse()),
    };
  }

  return new Proof({
    siblings,
    existence: onchainProof.existence,
    nodeAux,
  });
}

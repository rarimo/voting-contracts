import { ethers } from "hardhat";

import { MerkleTree } from "merkletreejs";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { buildSparseMerkleTree, getPoseidon, poseidonHash, Reverter } from "@test-helpers";

import { Voting } from "@ethers-v6";

describe("Voting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let voting: Voting;

  let localMerkleTree: MerkleTree;

  let treeHeight = 6n;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();

    const Voting = await ethers.getContractFactory("Voting", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
      },
    });
    voting = await Voting.deploy(await verifier.getAddress(), treeHeight);

    localMerkleTree = buildSparseMerkleTree(poseidonHash, [], treeHeight);
  });

  afterEach(reverter.revert);

  describe("#access", () => {});

  describe("#vote", () => {});
});

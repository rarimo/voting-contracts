import { ethers } from "hardhat";

import { MerkleTree } from "merkletreejs";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  buildSparseMerkleTree,
  getBytes32PoseidonHash,
  getLazyProof,
  getPoseidon,
  getPositionalProof,
  poseidonHash,
  Reverter,
} from "@test-helpers";

import { Voting } from "@ethers-v6";
import { expect } from "chai";
import { generateSecrets, getCommitment, getPreImageZKP, getZKP, SecretPair } from "@/test/helpers/zkp-helper";
import { VerifierHelper } from "@/generated-types/contracts/Voting";

describe("Voting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let voting: Voting;

  let treeHeight = 20n;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("VoteVerifier");
    const voteVerifier = await Verifier.deploy();

    const PoseidonVerifier = await ethers.getContractFactory("PoseidonVerifier");
    const poseidonVerifier = await PoseidonVerifier.deploy();

    const Voting = await ethers.getContractFactory("Voting", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
      },
    });
    voting = await Voting.deploy(await voteVerifier.getAddress(), await poseidonVerifier.getAddress(), treeHeight);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should correctly initialize the contract", async () => {
      expect(await voting.owner()).to.equal(OWNER.address);
    });
  });

  describe("#registerForVoting", () => {
    it("should register with correct ZKP proof", async () => {
      const pair = generateSecrets();

      const dataToVerify = await getPreImageZKP(pair);

      const commitment = getCommitment(pair);

      await voting.registerForVoting(commitment, dataToVerify.formattedProof);
    });

    it("should not register with incorrect ZKP proof", async () => {
      const pair = generateSecrets();

      const dataToVerify = await getPreImageZKP(pair);

      const incorrectCommitment = getCommitment(generateSecrets());

      await expect(voting.registerForVoting(incorrectCommitment, dataToVerify.formattedProof)).to.be.revertedWith(
        "Voting: Invalid vote proof",
      );
    });

    it("should not add same commitment twice", async () => {
      const pair = generateSecrets();

      const dataToVerify = await getPreImageZKP(pair);

      const commitment = getCommitment(pair);

      await voting.registerForVoting(commitment, dataToVerify.formattedProof);

      await expect(voting.registerForVoting(commitment, dataToVerify.formattedProof)).to.be.revertedWith(
        "Voting: commitment already exists",
      );
    });
  });

  describe("#vote", () => {
    let pair: SecretPair;
    let root: string;

    let zkpProof: { formattedProof: VerifierHelper.ProofPointsStruct; nullifierHash: string };

    beforeEach("register", async () => {
      pair = generateSecrets();

      pair.secret = ethers.ZeroHash;
      pair.nullifier = ethers.ZeroHash;

      const dataToVerify = await getPreImageZKP(pair);

      await voting.registerForVoting(getCommitment(pair), dataToVerify.formattedProof);

      root = await voting.getRoot();

      const [actualPathIndices, actualPathElements] = getLazyProof(
        poseidonHash,
        0,
        [getBytes32PoseidonHash(getCommitment(pair))],
        treeHeight,
      );

      zkpProof = await getZKP(pair, 1n, root, actualPathIndices, actualPathElements);
    });

    it("should vote with correct ZKP proof", async () => {
      await voting.vote(root, zkpProof.nullifierHash, 1n, zkpProof.formattedProof);
    });

    it("should not vote with incorrect ZKP proof", async () => {
      zkpProof.formattedProof.a[0] = ethers.ZeroHash;

      await expect(voting.vote(root, zkpProof.nullifierHash, 1n, zkpProof.formattedProof)).to.be.revertedWith(
        "Voting: Invalid vote proof",
      );
    });

    it("should not vote with non-existing root", async () => {
      await expect(
        voting.vote(ethers.ZeroHash, zkpProof.nullifierHash, 1n, zkpProof.formattedProof),
      ).to.be.revertedWith("Vote: root doesn't exist");
    });

    it("should not vote twice", async () => {
      await voting.vote(root, zkpProof.nullifierHash, 1n, zkpProof.formattedProof);

      await expect(voting.vote(root, zkpProof.nullifierHash, 1n, zkpProof.formattedProof)).to.be.revertedWith(
        "Voting: nullifier already used",
      );
    });
  });

  describe("#addRoot", () => {
    it("should record a root in history only by the owner", async () => {
      await expect(voting.connect(FIRST).addRoot(ethers.ZeroHash))
        .to.be.revertedWithCustomError(voting, "OwnableUnauthorizedAccount")
        .withArgs(FIRST.address);

      await expect(voting.addRoot(ethers.ZeroHash)).to.be.eventually.fulfilled;
    });
  });

  describe("#getLazyProof", () => {
    let localMerkleTree: MerkleTree;

    let testTreeHeight = 6n;

    it("should return a proof for a leaf", async () => {
      const pair = generateSecrets();
      const commitment = getCommitment(pair);

      localMerkleTree = buildSparseMerkleTree(poseidonHash, [getBytes32PoseidonHash(commitment)], testTreeHeight);

      const leaf = getBytes32PoseidonHash(commitment);

      let [expectedPathIndices, expectedPathElements] = getPositionalProof(localMerkleTree, leaf);

      expectedPathIndices = expectedPathIndices.map((x) => (x == 0 ? 1 : 0));

      const [actualPathIndices, actualPathElements] = getLazyProof(
        poseidonHash,
        0,
        [getBytes32PoseidonHash(commitment)],
        testTreeHeight,
      );

      expect(expectedPathIndices).to.deep.equal(actualPathIndices);
      expect(expectedPathElements).to.deep.equal(actualPathElements);
    });

    it("should return a proof for a leaf with a lot of leaves", async () => {
      let pairs = [];
      let commitments = [];

      for (let i = 0; i < 4; i++) {
        const pair = generateSecrets();
        const commitment = getCommitment(pair);

        pairs.push(pair);
        commitments.push(commitment);
      }

      localMerkleTree = buildSparseMerkleTree(poseidonHash, commitments.map(getBytes32PoseidonHash), testTreeHeight);

      const leaf = getBytes32PoseidonHash(getCommitment(pairs[3]));

      let [expectedPathIndices, expectedPathElements] = getPositionalProof(localMerkleTree, leaf);

      expectedPathIndices = expectedPathIndices.map((x) => (x == 0 ? 1 : 0));

      const [actualPathIndices, actualPathElements] = getLazyProof(
        poseidonHash,
        3,
        commitments.map(getBytes32PoseidonHash),
        testTreeHeight,
      );

      expect(expectedPathIndices).to.deep.equal(actualPathIndices);
      expect(expectedPathElements).to.deep.equal(actualPathElements);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { deepClone, VotingStatus } from "@scripts";

import {
  poseidonHash,
  Reverter,
  generateSecrets,
  getCommitment,
  getVoteZKP,
  SecretPair,
  getPoseidon,
} from "@test-helpers";

import { IVoting, VoteVerifier, RegistrationMock, Voting } from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/core/Voting";

describe("Voting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let voting: Voting;
  let registration: RegistrationMock;
  let votingVerifier: VoteVerifier;

  let treeHeight = 80n;

  let defaultVotingParams: IVoting.VotingParamsStruct = {
    remark: "Voting remark",
    registration: ethers.ZeroAddress,
    votingStart: 0,
    votingPeriod: 60,
    candidates: [],
  };

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");

    defaultVotingParams.candidates = [ethers.toBeHex(OWNER.address, 32)];

    const VotingVerifier = await ethers.getContractFactory("VoteVerifier");
    votingVerifier = await VotingVerifier.deploy();

    const RegistrationMock = await ethers.getContractFactory("RegistrationMock", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    registration = await RegistrationMock.deploy(treeHeight);

    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(await votingVerifier.getAddress());

    let proxy = await Proxy.deploy(await voting.getAddress(), "0x");
    voting = voting.attach(await proxy.getAddress()) as Voting;

    defaultVotingParams.registration = await registration.getAddress();

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#initialize", () => {
    it("should correctly initialize the contract", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      const actualVotingParams = await voting.votingInfo();
      expect(actualVotingParams.remark).to.equal(votingParams.remark);
      expect(actualVotingParams["1"].votingStartTime).to.equal(votingParams.votingStart);
      expect(actualVotingParams["1"].votingEndTime).to.equal(
        BigInt(votingParams.votingStart) + BigInt(votingParams.votingPeriod),
      );
      expect(actualVotingParams["1"].candidates).to.deep.equal(votingParams.candidates);

      expect(await voting.voteVerifier()).to.equal(await votingVerifier.getAddress());

      const actualRegistrationAddress = await voting.getRegistrationAddresses();
      expect(actualRegistrationAddress).to.deep.equal([votingParams.registration]);
    });

    it("should revert if voting start is in the past", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith("Voting: voting start must be in the future");
    });

    it("should revert if voting period is 0", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
        votingPeriod: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith(
        "Voting: voting period must be greater than 0",
      );
    });

    it("should revert if candidates are not provided", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
        candidates: [],
      };

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith("Voting: candidates must be provided");
    });

    it("should revert if too many candidates are provided", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
        candidates: new Array(101).fill(ethers.ZeroHash),
      };

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith("Voting: too many candidates");
    });

    it("should revert if registration contract is not provided", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
        registration: ethers.ZeroAddress,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith(
        "Voting: registration contract must be provided",
      );
    });

    it("should revert if registration phase is not over", async () => {
      const votingParams: IVoting.VotingParamsStruct = {
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
      };

      await registration.setRegistrationStatus(true);

      await expect(voting.__Voting_init(votingParams)).to.be.rejectedWith(
        "Voting: voting start must be after registration end",
      );
    });
  });

  describe("#vote", () => {
    let pair: SecretPair;
    let root: string;

    let zkpProof: { formattedProof: VerifierHelper.ProofPointsStruct; nullifierHash: string };

    beforeEach("register", async () => {
      pair = generateSecrets();

      const commitment = getCommitment(pair);

      await registration.registerMock(commitment);

      root = await registration.getRoot();

      const votingIndex = poseidonHash(commitment);

      const onchainProof = await registration.getProof(votingIndex);

      zkpProof = await getVoteZKP(
        pair,
        root,
        ethers.toBeHex(OWNER.address, 32),
        await voting.getAddress(),
        onchainProof.siblings,
      );

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
      });

      await time.increaseTo((await voting.votingInfo())["1"].votingStartTime);
    });

    it("should revert if trying to vote not during the voting period", async () => {
      await time.increase(Number(defaultVotingParams.votingPeriod));

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.rejectedWith("Voting: the voting must be in the pending state to vote");
    });

    it("should vote with correct ZKP proof", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);
    });

    it("should revert if trying to vote for non-candidate", async () => {
      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(FIRST.address, 32), zkpProof.formattedProof),
      ).to.be.rejectedWith("Voting: candidate doesn't exist");
    });

    it("should revert if vote with incorrect ZKP proof", async () => {
      zkpProof.formattedProof.a[0] = ethers.ZeroHash;

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.rejectedWith("Voting: Invalid vote proof");
    });

    it("should revert if vote with non-existing root", async () => {
      await expect(
        voting.vote(
          ethers.ZeroHash,
          zkpProof.nullifierHash,
          ethers.toBeHex(OWNER.address, 32),
          zkpProof.formattedProof,
        ),
      ).to.be.rejectedWith("Voting: root doesn't exist");
    });

    it("should revert if vote with used nullifier hash", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.rejectedWith("Voting: nullifier already used");
    });
  });

  describe("#getters", () => {
    it("should support interfaces: IVoting, IVotingPool", async () => {
      // IVoting -- 0x3ac8e5a3
      expect(await voting.supportsInterface("0x3ac8e5a3")).to.be.true;

      // IVotingPool -- 0xe8188f97
      expect(await voting.supportsInterface("0xe8188f97")).to.be.true;
    });
  });

  describe("#getProposalStatus", () => {
    it("should return correct proposal status", async () => {
      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NONE);

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        votingStart: (await time.latest()) + 60,
      });

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NOT_STARTED);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.PENDING);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.ENDED);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { deepClone, VotingStatus } from "@scripts";

import { getPoseidon, poseidonHash, Reverter, generateSecrets, getCommitment, getZKP, SecretPair } from "@test-helpers";

import { IVoting, VoteVerifier, VotingMock } from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/Voting";
import { IBaseVerifier, IRegisterVerifier } from "@/generated-types/contracts/mock/VotingMock";

describe("Voting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let voting: VotingMock;
  let votingVerifier: VoteVerifier;

  let treeHeight = 80n;

  let defaultVotingParams: IVoting.VotingParamsStruct = {
    remark: "Voting remark",
    commitmentStart: 0,
    commitmentPeriod: 60,
    votingPeriod: 60,
    candidates: [],
  };

  let defaultProveIdentityParams: IBaseVerifier.ProveIdentityParamsStruct = {
    statesMerkleData: {
      issuerId: 0,
      issuerState: 0,
      merkleProof: [],
      createdAtTimestamp: 0,
    },
    inputs: [],
    a: [0, 0],
    b: [
      [0, 0],
      [0, 0],
    ],
    c: [0, 0],
  };

  let defaultTransitionStateParams: IBaseVerifier.TransitStateParamsStruct = {
    newIdentitiesStatesRoot: ethers.ZeroHash,
    gistData: {
      root: ethers.ZeroHash,
      createdAtTimestamp: 0,
    },
    proof: "0x",
  };

  let defaultRegisterVerifierParams: IRegisterVerifier.RegisterProofParamsStruct = {
    isAdult: false,
    issuingAuthority: ethers.ZeroHash,
    commitment: ethers.ZeroHash,
    documentNullifier: ethers.ZeroHash,
  };

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    defaultVotingParams.candidates = [ethers.toBeHex(OWNER.address, 32)];

    const VotingVerifier = await ethers.getContractFactory("VoteVerifier");
    votingVerifier = await VotingVerifier.deploy();

    const Voting = await ethers.getContractFactory("VotingMock", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    voting = await Voting.deploy(await votingVerifier.getAddress(), ethers.ZeroAddress, treeHeight);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#initialize", () => {
    it("should correctly initialize the contract", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      const actualVotingParams = await voting.votingInfo();
      expect(actualVotingParams.remark).to.equal(votingParams.remark);
      expect(actualVotingParams["1"].commitmentStartTime).to.equal(votingParams.commitmentStart);
      expect(actualVotingParams["1"].votingStartTime).to.equal(
        BigInt(votingParams.commitmentStart) + BigInt(votingParams.commitmentPeriod),
      );
      expect(actualVotingParams["1"].votingEndTime).to.equal(
        BigInt(votingParams.commitmentStart) +
          BigInt(votingParams.commitmentPeriod) +
          BigInt(votingParams.votingPeriod),
      );
      expect(await voting.smtTreeMaxDepth()).to.equal(treeHeight);
      expect(await voting.owner()).to.equal(OWNER.address);

      expect(await voting.voteVerifier()).to.equal(await votingVerifier.getAddress());
    });

    it("should revert if commitment start is in the past", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: commitment start must be in the future",
      );
    });

    it("should revert if commitment period is 0", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        commitmentPeriod: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: commitment period must be greater than 0",
      );
    });

    it("should revert if voting period is 0", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        votingPeriod: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: voting period must be greater than 0",
      );
    });

    it("should revert if candidates are not provided", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        candidates: [],
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith("Voting: candidates must be provided");
    });
  });

  describe("#registerForVoting", () => {
    let commitmentStartTimestamp: number;

    beforeEach("setup", async () => {
      commitmentStartTimestamp = (await time.latest()) + 60;

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: commitmentStartTimestamp,
      });
    });

    it("should revert if trying to register not during the commitment period", async () => {
      await expect(
        voting.registerForVoting(
          defaultProveIdentityParams,
          defaultRegisterVerifierParams,
          defaultTransitionStateParams,
          false,
        ),
      ).to.be.rejectedWith("Voting: the voting must be in the commitment state to register");
    });

    it("should revert if commitment was already used", async () => {
      await time.increase(commitmentStartTimestamp);

      await voting.registerForVotingMock(defaultRegisterVerifierParams);

      await expect(
        voting.registerForVoting(
          defaultProveIdentityParams,
          defaultRegisterVerifierParams,
          defaultTransitionStateParams,
          false,
        ),
      ).to.be.rejectedWith("Voting: commitment already exists");
    });
  });

  describe("#vote", () => {
    let pair: SecretPair;
    let root: string;

    let zkpProof: { formattedProof: VerifierHelper.ProofPointsStruct; nullifierHash: string };

    beforeEach("register", async () => {
      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 20,
      });

      pair = generateSecrets();

      const commitment = getCommitment(pair);

      const registerVerifierParams = {
        ...deepClone(defaultRegisterVerifierParams),
        commitment: commitment,
      };

      await time.increaseTo((await voting.votingInfo())["1"].commitmentStartTime);

      await voting.registerForVotingMock(registerVerifierParams);

      root = await voting.getRoot();

      const commitmentIndex = poseidonHash(commitment);

      const onchainProof = await voting.getProof(commitmentIndex);

      zkpProof = await getZKP(
        pair,
        root,
        ethers.toBeHex(OWNER.address, 32),
        await voting.getAddress(),
        onchainProof.siblings,
      );

      await time.increase((await time.latest()) + Number(defaultVotingParams.commitmentPeriod));
    });

    it("should revert if trying to vote not during the voting period", async () => {
      await time.increase(Number(defaultVotingParams.votingPeriod));

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: the voting must be in the pending state to vote");
    });

    it("should vote with correct ZKP proof", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);
    });

    it("should revert if trying to vote for non-canidate", async () => {
      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(FIRST.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: candidate doesn't exist");
    });

    it("should revert if vote with incorrect ZKP proof", async () => {
      zkpProof.formattedProof.a[0] = ethers.ZeroHash;

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: Invalid vote proof");
    });

    it("should revert if vote with incorrect nullifier hash", async () => {
      await expect(
        voting.vote(
          ethers.ZeroHash,
          zkpProof.nullifierHash,
          ethers.toBeHex(OWNER.address, 32),
          zkpProof.formattedProof,
        ),
      ).to.be.revertedWith("Voting: root doesn't exist");
    });

    it("should revert if vote with used nullifier hash", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: nullifier already used");
    });
  });

  describe("#getProposalStatus", () => {
    it("should return correct proposal status", async () => {
      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NONE);

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      });

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NOT_STARTED);

      await time.increase(Number(defaultVotingParams.commitmentPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.COMMITMENT);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.PENDING);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.ENDED);
    });
  });

  describe("#addRoot", () => {
    it("should record a root in history only by the owner", async () => {
      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      });

      await expect(voting.connect(FIRST).addRoot(ethers.ZeroHash)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await expect(voting.addRoot(ethers.ZeroHash)).to.be.eventually.fulfilled;
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { getPoseidon, Reverter } from "@test-helpers";

import { IVoting, VotingFactory, VotingRegistry, Voting, Voting__factory } from "@ethers-v6";
import { IMPLEMENTATION_SLOT } from "@scripts";

describe("VotingFactory", () => {
  const reverter = new Reverter();

  const VOTING_TYPE = "Voting Type 1";

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let votingImplementation: Voting;
  let votingFactory: VotingFactory;
  let votingRegistry: VotingRegistry;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const VotingFactory = await ethers.getContractFactory("VotingFactory");
    votingFactory = await VotingFactory.deploy();

    const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
    votingRegistry = await VotingRegistry.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");

    const votingFactoryProxy = await Proxy.deploy(await votingFactory.getAddress(), "0x");
    const votingRegistryProxy = await Proxy.deploy(await votingRegistry.getAddress(), "0x");

    votingFactory = VotingFactory.attach(await votingFactoryProxy.getAddress()) as VotingFactory;
    votingRegistry = VotingRegistry.attach(await votingRegistryProxy.getAddress()) as VotingRegistry;

    await votingFactory.__VotingFactory_init(await votingRegistry.getAddress());
    await votingRegistry.__VotingRegistry_init(await votingFactory.getAddress());

    const Voting = await ethers.getContractFactory("Voting", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    votingImplementation = await Voting.deploy(ethers.ZeroAddress, ethers.ZeroAddress, 80);

    await votingRegistry.setNewImplementations([VOTING_TYPE], [await votingImplementation.getAddress()]);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(votingFactory.__VotingFactory_init(await votingRegistry.getAddress())).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#createVoting", () => {
    let votingParams: IVoting.VotingParamsStruct;

    before("setup", async () => {
      votingParams = {
        remark: "Voting remark",
        commitmentStart: (await time.latest()) + 60,
        commitmentPeriod: 60,
        votingPeriod: 60,
        candidates: [ethers.toBeHex(OWNER.address, 32)],
      };
    });

    it("should revert if trying to create a voting with non-existing type", async () => {
      await expect(votingFactory.createVoting("Non-existing", votingParams)).to.be.revertedWith(
        "VotingFactory: voting type does not exist",
      );

      await expect(
        votingFactory.createVotingWithSalt("Non-existing type", votingParams, ethers.ZeroHash),
      ).to.be.revertedWith("VotingFactory: voting type does not exist");
    });

    it("should create a voting with correct parameters", async () => {
      await expect(votingFactory.createVoting(VOTING_TYPE, votingParams)).to.emit(votingFactory, "VotingCreated");

      const voting = Voting__factory.connect((await votingRegistry.listPoolsByType(VOTING_TYPE, 0, 1))[0], OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].commitmentStartTime).to.equal(votingParams.commitmentStart);
      expect(await voting.smtTreeMaxDepth()).to.equal(80);
    });

    it("should create a deterministic voting with correct parameters", async () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));

      const predictedAddress = await votingFactory.predictVotingAddress(VOTING_TYPE, OWNER.address, salt);

      await expect(votingFactory.createVotingWithSalt(VOTING_TYPE, votingParams, salt))
        .to.emit(votingFactory, "VotingCreated")
        .withArgs(VOTING_TYPE, OWNER.address, predictedAddress);

      const voting = Voting__factory.connect(predictedAddress, OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].commitmentStartTime).to.equal(votingParams.commitmentStart);
      expect(await voting.smtTreeMaxDepth()).to.equal(80);
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const VotingFactory = await ethers.getContractFactory("VotingFactory");
      const newImplementation = await VotingFactory.deploy();

      await expect(votingFactory.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.revertedWith(
        "VotingFactory: only registry owner can upgrade",
      );

      await votingFactory.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await votingFactory.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

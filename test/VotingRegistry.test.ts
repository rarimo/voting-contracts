import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter } from "@test-helpers";

import { VotingRegistry } from "@ethers-v6";
import { IMPLEMENTATION_SLOT } from "@scripts";

describe("VotingRegistry", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let FACTORY: SignerWithAddress;

  let votingRegistry: VotingRegistry;

  before("setup", async () => {
    [OWNER, FIRST, FACTORY] = await ethers.getSigners();

    const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
    votingRegistry = await VotingRegistry.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const votingRegistryProxy = await Proxy.deploy(await votingRegistry.getAddress(), "0x");

    votingRegistry = VotingRegistry.attach(await votingRegistryProxy.getAddress()) as VotingRegistry;

    await votingRegistry.__VotingRegistry_init(FACTORY.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(votingRegistry.__VotingRegistry_init(FACTORY.address)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("should call a `setNewImplementations` function only by the owner", async () => {
      await expect(votingRegistry.connect(FIRST).setNewImplementations([], [])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should call a `addProxyPool` function only by the factory", async () => {
      await expect(votingRegistry.connect(FIRST).addProxyPool("", OWNER.address, FIRST.address)).to.be.revertedWith(
        "VotingRegistry: only factory can call this function",
      );
    });
  });

  describe("#setNewImplementations", () => {
    it("should set valid contract as a new implementation", async () => {
      await expect(
        votingRegistry.connect(OWNER).setNewImplementations(["Voting Type 1"], [ethers.ZeroAddress]),
      ).to.be.rejectedWith("VotingRegistry: the implementation address is not a contract");

      const Voting = await ethers.getContractFactory("VotingFactory");
      const voting = await Voting.deploy();

      await votingRegistry.connect(OWNER).setNewImplementations(["Voting Type 1"], [await voting.getAddress()]);

      expect(await votingRegistry.getVotingImplementation("Voting Type 1")).to.be.equal(await voting.getAddress());
    });

    it("should revert if names and addresses arrays have different lengths", async () => {
      await expect(votingRegistry.connect(OWNER).setNewImplementations(["Voting Type 1"], [])).to.be.revertedWith(
        "VotingRegistry: names and implementations length mismatch",
      );
    });
  });

  describe("#addProxyPool", () => {
    it("should add a valid pool", async () => {
      await votingRegistry.connect(FACTORY).addProxyPool("Voting Type 1", OWNER.address, FIRST.address);

      expect(await votingRegistry.isVotingExistByType("Voting Type 1", FIRST.address)).to.be.true;
      expect(await votingRegistry.votingCountWithinPoolByType("Voting Type 1")).to.be.equal(1);
      expect(await votingRegistry.listPoolsByType("Voting Type 1", 0, 1)).to.be.deep.equal([FIRST.address]);

      expect(await votingRegistry.isVotingExistByProposer(OWNER.address, FIRST.address)).to.be.true;
      expect(await votingRegistry.votingCountWithinPoolByProposer(OWNER.address)).to.be.equal(1);
      expect(await votingRegistry.listPoolsByProposer(OWNER.address, 0, 1)).to.be.deep.equal([FIRST.address]);
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
      const newImplementation = await VotingRegistry.deploy();

      await expect(votingRegistry.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await votingRegistry.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await votingRegistry.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

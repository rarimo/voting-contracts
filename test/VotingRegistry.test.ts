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
    const poolRegistryProxy = await Proxy.deploy(await votingRegistry.getAddress(), "0x");

    votingRegistry = VotingRegistry.attach(await poolRegistryProxy.getAddress()) as VotingRegistry;

    await votingRegistry.__VotingRegistry_init(FACTORY.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(votingRegistry.__VotingRegistry_init(FACTORY.address)).to.be.rejectedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("should call a `setNewImplementations` function only by the owner", async () => {
      await expect(votingRegistry.connect(FIRST).setNewImplementations([], [])).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should call a `addProxyPool` function only by the factory", async () => {
      await expect(votingRegistry.connect(FIRST).addProxyPool("", OWNER.address, FIRST.address)).to.be.rejectedWith(
        "VotingRegistry: only factory can call this function",
      );
    });

    it("should call a `bindVotingToRegistration` function only by the factory", async () => {
      await expect(
        votingRegistry.connect(FIRST).bindVotingToRegistration(OWNER.address, OWNER.address, FIRST.address),
      ).to.be.rejectedWith("VotingRegistry: only factory can call this function");
    });
  });

  describe("#setNewImplementations", () => {
    it("should set valid contract as a new implementation", async () => {
      await expect(
        votingRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [ethers.ZeroAddress]),
      ).to.be.rejectedWith("VotingRegistry: the implementation address is not a contract");

      const Pool = await ethers.getContractFactory("VotingFactory");
      const pool = await Pool.deploy();

      await votingRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [await pool.getAddress()]);

      expect(await votingRegistry.getPoolImplementation("Pool Type 1")).to.be.equal(await pool.getAddress());
    });

    it("should revert if names and addresses arrays have different lengths", async () => {
      await expect(votingRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [])).to.be.rejectedWith(
        "VotingRegistry: names and implementations length mismatch",
      );
    });

    it("should revert if trying to set empty pool type", async () => {
      await expect(votingRegistry.connect(OWNER).setNewImplementations([""], [ethers.ZeroAddress])).to.be.rejectedWith(
        "VotingRegistry: pool type cannot be empty",
      );
    });
  });

  describe("#addProxyPool/bindVotingToRegistration", () => {
    it("should add a valid pool", async () => {
      await votingRegistry.connect(FACTORY).addProxyPool("Pool Type 1", OWNER.address, FIRST.address);

      expect(await votingRegistry.isPoolExistByType("Pool Type 1", FIRST.address)).to.be.true;
      expect(await votingRegistry.poolCountByType("Pool Type 1")).to.be.equal(1);
      expect(await votingRegistry.listPoolsByType("Pool Type 1", 0, 1)).to.be.deep.equal([FIRST.address]);

      expect(await votingRegistry.isPoolExistByProposer(OWNER.address, FIRST.address)).to.be.true;
      expect(await votingRegistry.poolCountByProposer(OWNER.address)).to.be.equal(1);
      expect(await votingRegistry.listPoolsByProposer(OWNER.address, 0, 1)).to.be.deep.equal([FIRST.address]);

      expect(await votingRegistry.isPoolExistByProposerAndType(OWNER.address, "Pool Type 1", FIRST.address)).to.be.true;
      expect(await votingRegistry.poolCountByProposerAndType(OWNER.address, "Pool Type 1")).to.be.equal(1);
      expect(await votingRegistry.listPoolsByProposerAndType(OWNER.address, "Pool Type 1", 0, 1)).to.be.deep.equal([
        FIRST.address,
      ]);
    });

    it("should bind a valid voting to the registration", async () => {
      await votingRegistry.connect(FACTORY).addProxyPool("Pool Type 1", OWNER.address, FIRST.address);

      expect(await votingRegistry.getVotingForRegistration(OWNER.address, FIRST.address)).to.be.equal(
        ethers.ZeroAddress,
      );

      await votingRegistry.connect(FACTORY).bindVotingToRegistration(OWNER.address, OWNER.address, FIRST.address);

      expect(await votingRegistry.getVotingForRegistration(OWNER.address, FIRST.address)).to.be.equal(OWNER.address);
    });

    it("should revert if trying to bind a voting to the registration that does not exist", async () => {
      await expect(
        votingRegistry.connect(FACTORY).bindVotingToRegistration(OWNER.address, OWNER.address, FIRST.address),
      ).to.be.rejectedWith("VotingRegistry: registration pool not found");
    });

    it("should revert if trying to bind the same address twice", async () => {
      await votingRegistry.connect(FACTORY).addProxyPool("Pool Type 1", OWNER.address, FIRST.address);

      await votingRegistry.connect(FACTORY).bindVotingToRegistration(OWNER.address, OWNER.address, FIRST.address);

      await expect(
        votingRegistry.connect(FACTORY).bindVotingToRegistration(OWNER.address, OWNER.address, FIRST.address),
      ).to.be.rejectedWith("VotingRegistry: registration pool already has a voting contract");
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
      const newImplementation = await VotingRegistry.deploy();

      await expect(votingRegistry.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await votingRegistry.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await votingRegistry.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

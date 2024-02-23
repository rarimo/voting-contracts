import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter } from "@test-helpers";

import { PoolRegistry } from "@ethers-v6";
import { IMPLEMENTATION_SLOT } from "@scripts";

describe("PoolRegistry", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let FACTORY: SignerWithAddress;

  let poolRegistry: PoolRegistry;

  before("setup", async () => {
    [OWNER, FIRST, FACTORY] = await ethers.getSigners();

    const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
    poolRegistry = await PoolRegistry.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const poolRegistryProxy = await Proxy.deploy(await poolRegistry.getAddress(), "0x");

    poolRegistry = PoolRegistry.attach(await poolRegistryProxy.getAddress()) as PoolRegistry;

    await poolRegistry.__PoolRegistry_init(FACTORY.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(poolRegistry.__PoolRegistry_init(FACTORY.address)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("should call a `setNewImplementations` function only by the owner", async () => {
      await expect(poolRegistry.connect(FIRST).setNewImplementations([], [])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should call a `addProxyPool` function only by the factory", async () => {
      await expect(poolRegistry.connect(FIRST).addProxyPool("", OWNER.address, FIRST.address)).to.be.revertedWith(
        "PoolRegistry: only factory can call this function",
      );
    });
  });

  describe("#setNewImplementations", () => {
    it("should set valid contract as a new implementation", async () => {
      await expect(
        poolRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [ethers.ZeroAddress]),
      ).to.be.rejectedWith("PoolRegistry: the implementation address is not a contract");

      const Pool = await ethers.getContractFactory("PoolFactory");
      const pool = await Pool.deploy();

      await poolRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [await pool.getAddress()]);

      expect(await poolRegistry.getPoolImplementation("Pool Type 1")).to.be.equal(await pool.getAddress());
    });

    it("should revert if names and addresses arrays have different lengths", async () => {
      await expect(poolRegistry.connect(OWNER).setNewImplementations(["Pool Type 1"], [])).to.be.revertedWith(
        "PoolRegistry: names and implementations length mismatch",
      );
    });
  });

  describe("#addProxyPool", () => {
    it("should add a valid pool", async () => {
      await poolRegistry.connect(FACTORY).addProxyPool("Pool Type 1", OWNER.address, FIRST.address);

      expect(await poolRegistry.isPoolExistByType("Pool Type 1", FIRST.address)).to.be.true;
      expect(await poolRegistry.poolCountByType("Pool Type 1")).to.be.equal(1);
      expect(await poolRegistry.listPoolsByType("Pool Type 1", 0, 1)).to.be.deep.equal([FIRST.address]);

      expect(await poolRegistry.isPoolExistByProposer(OWNER.address, FIRST.address)).to.be.true;
      expect(await poolRegistry.poolCountByProposer(OWNER.address)).to.be.equal(1);
      expect(await poolRegistry.listPoolsByProposer(OWNER.address, 0, 1)).to.be.deep.equal([FIRST.address]);
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
      const newImplementation = await PoolRegistry.deploy();

      await expect(poolRegistry.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await poolRegistry.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await poolRegistry.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

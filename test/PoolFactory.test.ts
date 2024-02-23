import { expect } from "chai";
import { ethers } from "hardhat";
import { AddressLike } from "ethers";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { getPoseidon, Reverter } from "@test-helpers";

import { IMPLEMENTATION_SLOT } from "@scripts";

import { PoolFactory, PoolRegistry, RegistrationMock, Voting__factory } from "@ethers-v6";
import { IVoting } from "@/generated-types/contracts/Voting";

describe("PoolFactory", () => {
  const reverter = new Reverter();

  const VOTING_TYPE = "Pool Type 1";

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;

  let votingImplementation: AddressLike;
  let votingFactory: PoolFactory;
  let votingRegistry: PoolRegistry;

  let registration: RegistrationMock;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    votingFactory = await PoolFactory.deploy();

    const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
    votingRegistry = await PoolRegistry.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");

    const votingFactoryProxy = await Proxy.deploy(await votingFactory.getAddress(), "0x");
    const votingRegistryProxy = await Proxy.deploy(await votingRegistry.getAddress(), "0x");

    votingFactory = PoolFactory.attach(await votingFactoryProxy.getAddress()) as PoolFactory;
    votingRegistry = PoolRegistry.attach(await votingRegistryProxy.getAddress()) as PoolRegistry;

    await votingFactory.__PoolFactory_init(await votingRegistry.getAddress());
    await votingRegistry.__PoolRegistry_init(await votingFactory.getAddress());

    const Voting = await ethers.getContractFactory("Voting");
    votingImplementation = await Voting.deploy(ethers.ZeroAddress);

    const RegistrationMock = await ethers.getContractFactory("RegistrationMock", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    registration = await RegistrationMock.deploy(80n);

    await votingRegistry.setNewImplementations([VOTING_TYPE], [await votingImplementation.getAddress()]);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(votingFactory.__PoolFactory_init(await votingRegistry.getAddress())).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#createPool", () => {
    let votingParams: IVoting.VotingParamsStruct;
    let votingParamsEncoded: string;

    before("setup", async () => {
      votingParams = {
        remark: "Pool remark",
        registration: await registration.getAddress(),
        votingStart: (await time.latest()) + 60,
        votingPeriod: 60,
        candidates: [ethers.toBeHex(OWNER.address, 32)],
      };

      votingParamsEncoded = Voting__factory.createInterface().encodeFunctionData("__Voting_init", [votingParams]);
    });

    it("should revert if trying to create a voting with non-existing type", async () => {
      await expect(votingFactory.createPool("Non-existing", votingParamsEncoded)).to.be.revertedWith(
        "PoolFactory: voting type does not exist",
      );

      await expect(
        votingFactory.createPoolWithSalt("Non-existing type", votingParamsEncoded, ethers.ZeroHash),
      ).to.be.revertedWith("PoolFactory: voting type does not exist");
    });

    it("should create a voting with correct parameters", async () => {
      await expect(votingFactory.createPool(VOTING_TYPE, votingParamsEncoded)).to.emit(votingFactory, "PoolCreated");

      const voting = Voting__factory.connect((await votingRegistry.listPoolsByType(VOTING_TYPE, 0, 1))[0], OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].votingStartTime).to.equal(votingParams.votingStart);
    });

    it("should create a deterministic voting with correct parameters", async () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));

      const predictedAddress = await votingFactory.predictPoolAddress(VOTING_TYPE, OWNER.address, salt);

      await expect(votingFactory.createPoolWithSalt(VOTING_TYPE, votingParamsEncoded, salt))
        .to.emit(votingFactory, "PoolCreated")
        .withArgs(VOTING_TYPE, OWNER.address, predictedAddress);

      const voting = Voting__factory.connect(predictedAddress, OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].votingStartTime).to.equal(votingParams.votingStart);
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const PoolFactory = await ethers.getContractFactory("PoolFactory");
      const newImplementation = await PoolFactory.deploy();

      await expect(votingFactory.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.revertedWith(
        "PoolFactory: only registry owner can upgrade",
      );

      await votingFactory.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await votingFactory.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

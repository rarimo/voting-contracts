import { expect } from "chai";
import { ethers } from "hardhat";
import { AddressLike } from "ethers";

import { impersonateAccount, setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { getPoseidon, Reverter } from "@test-helpers";

import { IMPLEMENTATION_SLOT, wei } from "@scripts";

import { VotingFactory, VotingRegistry, RegistrationMock, Voting__factory, Registration__factory } from "@ethers-v6";
import { IVoting } from "@/generated-types/contracts/core/Voting";
import { IRegistration } from "@/generated-types/contracts/core/Registration";

describe("VotingFactory", () => {
  const reverter = new Reverter();

  const VOTING_TYPE = "Simple Voting";
  const REGISTRATION_TYPE = "Simple Registration";

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let FACTORY: SignerWithAddress;

  let votingImplementation: AddressLike;
  let registrationImplementation: AddressLike;

  let votingFactory: VotingFactory;
  let votingRegistry: VotingRegistry;

  let registrationMock: RegistrationMock;

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

    const Voting = await ethers.getContractFactory("Voting");
    votingImplementation = await Voting.deploy(ethers.ZeroAddress);

    const Registration = await ethers.getContractFactory("Registration", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    registrationImplementation = await Registration.deploy(ethers.ZeroAddress, 80n);

    const RegistrationMock = await ethers.getContractFactory("RegistrationMock", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    registrationMock = await RegistrationMock.deploy(80n);

    await votingRegistry.setNewImplementations(
      [VOTING_TYPE, REGISTRATION_TYPE],
      [await votingImplementation.getAddress(), await registrationImplementation.getAddress()],
    );

    await impersonateAccount(await votingFactory.getAddress());

    FACTORY = await ethers.provider.getSigner(await votingFactory.getAddress());
    await setBalance(FACTORY.address, wei("1000"));

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      await expect(votingFactory.__VotingFactory_init(await votingRegistry.getAddress())).to.be.rejectedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#create{Voting, Registration}", () => {
    let votingParams: IVoting.VotingParamsStruct;
    let votingParamsEncoded: string;

    let registrationParams: IRegistration.RegistrationParamsStruct;
    let registrationParamsEncoded: string;

    before("setup", async () => {
      votingParams = {
        remark: "Pool remark",
        registration: await registrationMock.getAddress(),
        votingStart: (await time.latest()) + 60,
        votingPeriod: 60,
        candidates: [ethers.toBeHex(OWNER.address, 32)],
      };

      votingParamsEncoded = Voting__factory.createInterface().encodeFunctionData("__Voting_init", [votingParams]);

      registrationParams = {
        remark: "Pool remark",
        commitmentStart: (await time.latest()) + 60,
        commitmentPeriod: 60,
      };

      registrationParamsEncoded = Registration__factory.createInterface().encodeFunctionData("__Registration_init", [
        registrationParams,
      ]);
    });

    it("should revert if trying to create a voting or registration with non-existing type", async () => {
      await expect(votingFactory.createVoting("Non-existing", votingParamsEncoded)).to.be.rejectedWith(
        "VotingFactory: pool type does not exist",
      );

      await expect(votingFactory.createRegistration("Non-existing", votingParamsEncoded)).to.be.rejectedWith(
        "VotingFactory: pool type does not exist",
      );

      await expect(
        votingFactory.createVotingWithSalt("Non-existing type", votingParamsEncoded, ethers.ZeroHash),
      ).to.be.rejectedWith("VotingFactory: pool type does not exist");

      await expect(
        votingFactory.createRegistrationWithSalt("Non-existing type", votingParamsEncoded, ethers.ZeroHash),
      ).to.be.rejectedWith("VotingFactory: pool type does not exist");
    });

    it("should create a voting with correct parameters", async () => {
      await votingRegistry
        .connect(FACTORY)
        .addProxyPool(REGISTRATION_TYPE, OWNER.address, await registrationMock.getAddress());

      await expect(votingFactory.createVoting(VOTING_TYPE, votingParamsEncoded)).to.emit(
        votingFactory,
        "InstanceCreated",
      );

      const voting = Voting__factory.connect((await votingRegistry.listPoolsByType(VOTING_TYPE, 0, 1))[0], OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].votingStartTime).to.equal(votingParams.votingStart);
    });

    it("should create a registration with correct parameters", async () => {
      await expect(votingFactory.createRegistration(REGISTRATION_TYPE, registrationParamsEncoded)).to.emit(
        votingFactory,
        "InstanceCreated",
      );

      const registration = Registration__factory.connect(
        (await votingRegistry.listPoolsByType(REGISTRATION_TYPE, 0, 1))[0],
        OWNER,
      );

      const registrationInfo = await registration.registrationInfo();

      expect(registrationInfo.remark).to.equal(registrationParams.remark);
      expect(registrationInfo["1"].commitmentStartTime).to.equal(registrationParams.commitmentStart);
    });

    it("should create a deterministic voting with correct parameters", async () => {
      await votingRegistry
        .connect(FACTORY)
        .addProxyPool(REGISTRATION_TYPE, OWNER.address, await registrationMock.getAddress());

      const salt = ethers.hexlify(ethers.randomBytes(32));

      const predictedAddress = await votingFactory.predictAddress(VOTING_TYPE, OWNER.address, salt);

      await expect(votingFactory.createVotingWithSalt(VOTING_TYPE, votingParamsEncoded, salt))
        .to.emit(votingFactory, "InstanceCreated")
        .withArgs(VOTING_TYPE, OWNER.address, predictedAddress);

      const voting = Voting__factory.connect(predictedAddress, OWNER);

      const votingInfo = await voting.votingInfo();

      expect(votingInfo.remark).to.equal(votingParams.remark);
      expect(votingInfo["1"].votingStartTime).to.equal(votingParams.votingStart);
    });

    it("should create a deterministic registration with correct parameters", async () => {
      const salt = ethers.hexlify(ethers.randomBytes(32));

      const predictedAddress = await votingFactory.predictAddress(REGISTRATION_TYPE, OWNER.address, salt);

      await expect(votingFactory.createRegistrationWithSalt(REGISTRATION_TYPE, registrationParamsEncoded, salt))
        .to.emit(votingFactory, "InstanceCreated")
        .withArgs(REGISTRATION_TYPE, OWNER.address, predictedAddress);

      const registration = Registration__factory.connect(predictedAddress, OWNER);

      const registrationInfo = await registration.registrationInfo();

      expect(registrationInfo.remark).to.equal(registrationParams.remark);
      expect(registrationInfo["1"].commitmentStartTime).to.equal(registrationParams.commitmentStart);
    });

    it("should revert if initializing a voting with invalid parameters", async () => {
      await expect(
        votingFactory.createVotingWithSalt(VOTING_TYPE, registrationParamsEncoded, ethers.ZeroHash),
      ).to.be.rejectedWith("VotingFactory: failed to initialize pool");
    });

    it("should revert if trying to create a voting that does not support IVotingPool interface", async () => {
      await expect(votingFactory.createVoting(REGISTRATION_TYPE, registrationParamsEncoded)).to.be.rejectedWith(
        "VotingFactory: voting pool does not support IVotingPool",
      );

      await expect(
        votingFactory.createVotingWithSalt(REGISTRATION_TYPE, registrationParamsEncoded, ethers.ZeroHash),
      ).to.be.rejectedWith("VotingFactory: voting pool does not support IVotingPool");
    });
  });

  describe("#upgradeImpleemntation", () => {
    it("should upgrade the implementation only by the owner", async () => {
      const VotingFactory = await ethers.getContractFactory("VotingFactory");
      const newImplementation = await VotingFactory.deploy();

      await expect(votingFactory.connect(FIRST).upgradeTo(await newImplementation.getAddress())).to.be.rejectedWith(
        "VotingFactory: only registry owner can upgrade",
      );

      await votingFactory.connect(OWNER).upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await votingFactory.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { generateMTPData, getRegisterZKP, Reverter } from "@test-helpers";

import { ILightweightState, LightweightState, QueryMTPValidator } from "@ethers-v6";
import { IMPLEMENTATION_SLOT } from "@scripts";

describe.only("QueryMTPValidator", () => {
  const reverter = new Reverter();

  const CHAIN_NAME = "chain";
  const SOURCE_CHAIN_NAME = "sourceChain";
  const SOURCE_CHAIN_CONTRACT = ethers.ZeroAddress;

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SIGNER: HDNodeWallet;

  let validator: QueryMTPValidator;
  let stateContract: LightweightState;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    SIGNER = ethers.Wallet.createRandom() as any;

    const LightweightState = await ethers.getContractFactory("LightweightState");
    stateContract = await LightweightState.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    let proxy = await Proxy.deploy(await stateContract.getAddress(), "0x");

    stateContract = stateContract.attach(await proxy.getAddress()) as LightweightState;

    await stateContract.__LightweightState_init(SIGNER.address, SOURCE_CHAIN_CONTRACT, CHAIN_NAME, SOURCE_CHAIN_NAME);

    const RegistrationVerifier = await ethers.getContractFactory("RegistrationVerifier");
    const registerVerifier = await RegistrationVerifier.deploy();

    const QueryMTPValidator = await ethers.getContractFactory("QueryMTPValidator");
    validator = await QueryMTPValidator.deploy();

    proxy = await Proxy.deploy(await validator.getAddress(), "0x");
    validator = validator.attach(await proxy.getAddress()) as QueryMTPValidator;

    await validator.__QueryMTPValidator_init(
      await registerVerifier.getAddress(),
      await stateContract.getAddress(),
      await time.latest(),
    );

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize twice", async () => {
      await expect(
        validator.__QueryMTPValidator_init(ethers.ZeroAddress, await stateContract.getAddress(), await time.latest()),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("should revert if trying to call inner initializer", async () => {
      await expect(
        validator.__QueryValidator_init(ethers.ZeroAddress, await stateContract.getAddress(), await time.latest()),
      ).to.be.revertedWith("Initializable: contract is not initializing");
    });
  });

  describe("#setters", () => {
    it("should set verifier only by owner", async () => {
      await expect(validator.connect(FIRST).setVerifier(ethers.ZeroAddress)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await validator.setVerifier(ethers.ZeroAddress);
    });

    it("should set identites states update time only by owner", async () => {
      await expect(validator.connect(FIRST).setIdentitesStatesUpdateTime(await time.latest())).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await validator.setIdentitesStatesUpdateTime(await time.latest());
    });
  });

  describe("#verify", () => {
    it.only("should verify correct ZKP", async () => {
      const [inputs] = await generateMTPData([]);

      const zkpData = await getRegisterZKP(inputs, await validator.getAddress(), ethers.ZeroHash);

      const statesMerkleData: ILightweightState.StatesMerkleDataStruct = {
        issuerId: 1,
        issuerState: 1,
        createdAtTimestamp: 1,
        merkleProof: [],
      };

      await validator.verify(statesMerkleData, zkpData[1], zkpData[0].a, zkpData[0].b, zkpData[0].c, 0);
    });
  });

  describe("#authorizeUpgrade", () => {
    it("should authorize upgrade only by owner", async () => {
      await expect(validator.connect(FIRST).upgradeTo(ethers.ZeroAddress)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      const QueryMTPValidator = await ethers.getContractFactory("QueryMTPValidator");
      const newImplementation = await QueryMTPValidator.deploy();

      await validator.upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await validator.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

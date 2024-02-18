import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { Reverter } from "@test-helpers";

import { ILightweightState, LightweightState } from "@ethers-v6";
import { IMPLEMENTATION_SLOT } from "@scripts";

enum MethodId {
  None,
  AuthorizeUpgrade,
  ChangeSourceStateContract,
}

describe("LightweightState", () => {
  const reverter = new Reverter();

  const CHAIN_NAME = "chain";
  const SOURCE_CHAIN_NAME = "sourceChain";
  const SOURCE_CHAIN_CONTRACT = ethers.ZeroAddress;

  let OWNER: HDNodeWallet;
  let SIGNER: HDNodeWallet;

  let stateContract: LightweightState;

  before("setup", async () => {
    OWNER = ethers.Wallet.createRandom() as any;
    SIGNER = ethers.Wallet.createRandom() as any;

    const LightweightState = await ethers.getContractFactory("LightweightState");
    stateContract = await LightweightState.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await Proxy.deploy(await stateContract.getAddress(), "0x");

    stateContract = stateContract.attach(await proxy.getAddress()) as LightweightState;

    await stateContract.__LightweightState_init(SIGNER.address, SOURCE_CHAIN_CONTRACT, CHAIN_NAME, SOURCE_CHAIN_NAME);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#access", () => {
    it("should not initialize twice", async () => {
      await expect(
        stateContract.__LightweightState_init(SIGNER.address, SOURCE_CHAIN_CONTRACT, CHAIN_NAME, SOURCE_CHAIN_NAME),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("#setters", () => {
    it("should change the signer", async () => {
      const publicKeyHash = ethers.solidityPackedKeccak256(["bytes"], [`0x` + OWNER.signingKey.publicKey.slice(4)]);

      const signature = SIGNER.signingKey.sign(publicKeyHash);

      await stateContract.changeSigner(`0x` + OWNER.signingKey.publicKey.slice(4), signature.serialized);

      expect(await stateContract.getFunction("signer").staticCall()).to.eq(OWNER.address);
    });

    it("should change the source chain contract", async () => {
      const newAddress = ethers.Wallet.createRandom().address;

      const [chainName, nonce] = await stateContract.getSigComponents(
        MethodId.ChangeSourceStateContract,
        await stateContract.getAddress(),
      );

      const signHash = ethers.keccak256(
        ethers.solidityPacked(
          ["uint8", "address", "string", "uint256", "address"],
          [MethodId.ChangeSourceStateContract, newAddress, chainName, nonce, await stateContract.getAddress()],
        ),
      );

      const signature = SIGNER.signingKey.sign(signHash);

      await stateContract.changeSourceStateContract(newAddress, signature.serialized);

      expect(await stateContract.getFunction("sourceStateContract").staticCall()).to.eq(newAddress);
    });

    it("should revert if trying to change the source chain contract to zero address", async () => {
      const newAddress = ethers.ZeroAddress;

      const [chainName, nonce] = await stateContract.getSigComponents(
        MethodId.ChangeSourceStateContract,
        await stateContract.getAddress(),
      );

      const signHash = ethers.keccak256(
        ethers.solidityPacked(
          ["uint8", "address", "string", "uint256", "address"],
          [MethodId.ChangeSourceStateContract, newAddress, chainName, nonce, await stateContract.getAddress()],
        ),
      );

      const signature = SIGNER.signingKey.sign(signHash);

      await expect(stateContract.changeSourceStateContract(newAddress, signature.serialized)).to.be.revertedWith(
        "LightweightState: Zero address",
      );
    });
  });

  describe("#signedTransitState", () => {
    let newIdentitiesStatesRoot: string;
    let gistRootData: ILightweightState.GistRootDataStruct;

    let proof: string;

    beforeEach("setup", async () => {
      newIdentitiesStatesRoot = ethers.id("2");
      gistRootData = {
        root: ethers.id("1"),
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(gistRootData, newIdentitiesStatesRoot);

      const signature = SIGNER.signingKey.sign(sigHash);

      proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);
    });

    it("should transit the state with signature", async () => {
      await stateContract.signedTransitState(newIdentitiesStatesRoot, gistRootData, proof);

      expect(await stateContract.isIdentitiesStatesRootExists(newIdentitiesStatesRoot)).to.be.true;

      const onchainGistRootData = await stateContract.getIdentitiesStatesRootData(newIdentitiesStatesRoot);
      expect(onchainGistRootData.root).to.eq(newIdentitiesStatesRoot);

      expect(await stateContract.getGISTRoot()).to.eq(gistRootData.root);
      expect((await stateContract.getCurrentGISTRootInfo()).root).to.eq(gistRootData.root);
      expect((await stateContract.geGISTRootData(gistRootData.root)).root).to.eq(gistRootData.root);
    });

    it("should revert if trying to transit same state", async () => {
      await stateContract.signedTransitState(newIdentitiesStatesRoot, gistRootData, proof);

      await expect(stateContract.signedTransitState(newIdentitiesStatesRoot, gistRootData, proof)).to.be.revertedWith(
        "LightweightState: Identities states root already exists",
      );
    });

    it("should revert if trying to transit with invalid Gist Data", async () => {
      gistRootData = {
        root: ethers.id("1"),
        createdAtTimestamp: 0,
      };

      const sigHash = await stateContract.getSignHash(gistRootData, newIdentitiesStatesRoot);
      const signature = SIGNER.signingKey.sign(sigHash);

      proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await expect(stateContract.signedTransitState(newIdentitiesStatesRoot, gistRootData, proof)).to.be.revertedWith(
        "LightweightState: Invalid GIST root data",
      );
    });

    it("should verify states merkle data", async () => {
      const statesMerkleData: ILightweightState.StatesMerkleDataStruct = {
        issuerId: 1,
        issuerState: 1,
        createdAtTimestamp: 1,
        merkleProof: [],
      };

      const packedHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [statesMerkleData.issuerId, statesMerkleData.issuerState, statesMerkleData.createdAtTimestamp],
      );

      gistRootData = {
        root: packedHash,
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(gistRootData, packedHash);
      const signature = SIGNER.signingKey.sign(sigHash);

      proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await stateContract.signedTransitState(packedHash, gistRootData, proof);

      const verified = await stateContract.verifyStatesMerkleData(statesMerkleData);

      expect(verified[0]).to.be.true;
      expect(verified[1]).to.be.eq(packedHash);
    });
  });

  describe("#authorizeUpgrade", () => {
    it("should revert if trying to upgrade not via signature", async () => {
      await expect(stateContract.upgradeTo(ethers.Wallet.createRandom().address)).to.be.revertedWith(
        "LightweightState: This upgrade method is off",
      );
    });

    it("should upgrade via signature", async () => {
      const LightweightState = await ethers.getContractFactory("LightweightState");
      const newImplementation = await LightweightState.deploy();

      const [chainName, nonce] = await stateContract.getSigComponents(
        MethodId.AuthorizeUpgrade,
        await stateContract.getAddress(),
      );

      const signHash = ethers.keccak256(
        ethers.solidityPacked(
          ["uint8", "address", "string", "uint256", "address"],
          [
            MethodId.AuthorizeUpgrade,
            await newImplementation.getAddress(),
            chainName,
            nonce,
            await stateContract.getAddress(),
          ],
        ),
      );

      const signature = SIGNER.signingKey.sign(signHash);

      await stateContract.upgradeToWithSig(await newImplementation.getAddress(), signature.serialized);

      expect(await ethers.provider.getStorage(await stateContract.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });

    it("should revert if trying to upgrade to zero address", async () => {
      const [chainName, nonce] = await stateContract.getSigComponents(
        MethodId.AuthorizeUpgrade,
        await stateContract.getAddress(),
      );

      const signHash = ethers.keccak256(
        ethers.solidityPacked(
          ["uint8", "address", "string", "uint256", "address"],
          [MethodId.AuthorizeUpgrade, ethers.ZeroAddress, chainName, nonce, await stateContract.getAddress()],
        ),
      );

      const signature = SIGNER.signingKey.sign(signHash);

      await expect(stateContract.upgradeToWithSig(ethers.ZeroAddress, signature.serialized)).to.be.revertedWith(
        "LightweightState: Zero address",
      );
    });
  });
});

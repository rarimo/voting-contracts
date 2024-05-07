import { expect } from "chai";
import { ethers } from "hardhat";

import { DID } from "@iden3/js-iden3-core";
import { Merklizer } from "@iden3/js-jsonld-merklization";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { deepClone, IMPLEMENTATION_SLOT } from "@scripts";

import {
  CredentialAtomicMTPOnChainV2Inputs,
  CredentialAtomicMTPOnChainV2Outputs,
  generateMTPData,
  getRegisterZKP,
  Identity,
  IDOwnershipLevels,
  IssuerLevels,
  IssuerPK,
  Reverter,
  TestClaimDocument,
  UserPK,
} from "@test-helpers";

import { ILightweightState, LightweightState, QueryMTPValidator } from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/core/Voting";

describe("QueryMTPValidator", () => {
  const reverter = new Reverter();

  const CHAIN_NAME = "chain";
  const SOURCE_CHAIN_NAME = "sourceChain";
  const SOURCE_CHAIN_CONTRACT = ethers.ZeroAddress;

  const IDENTITES_STATES_UPDATE_TIME = 60 * 60;

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

    const RegistrationVerifier = await ethers.getContractFactory("GeneratedRegistrationVerifier");
    const registerVerifier = await RegistrationVerifier.deploy();

    const QueryMTPValidator = await ethers.getContractFactory("QueryMTPValidator");
    validator = await QueryMTPValidator.deploy();

    proxy = await Proxy.deploy(await validator.getAddress(), "0x");
    validator = validator.attach(await proxy.getAddress()) as QueryMTPValidator;

    await validator.__QueryMTPValidator_init(
      await registerVerifier.getAddress(),
      await stateContract.getAddress(),
      IDENTITES_STATES_UPDATE_TIME,
    );

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  describe("#access", () => {
    it("should not initialize twice", async () => {
      await expect(
        validator.__QueryMTPValidator_init(ethers.ZeroAddress, await stateContract.getAddress(), await time.latest()),
      ).to.be.rejectedWith("Initializable: contract is already initialized");
    });

    it("should revert if trying to call inner initializer", async () => {
      const ValidatorMock = await ethers.getContractFactory("QueryValidatorMock");
      const validatorMock = await ValidatorMock.deploy();

      await expect(
        validatorMock.__QueryValidatorMock_init(
          ethers.ZeroAddress,
          await stateContract.getAddress(),
          await time.latest(),
        ),
      ).to.be.rejectedWith("Initializable: contract is not initializing");
    });
  });

  describe("#setters", () => {
    it("should set verifier only by owner", async () => {
      await expect(validator.connect(FIRST).setVerifier(ethers.ZeroAddress)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await validator.connect(OWNER).setVerifier(ethers.ZeroAddress);
    });

    it("should set identites states update time only by owner", async () => {
      await expect(validator.connect(FIRST).setIdentitesStatesUpdateTime(await time.latest())).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await validator.connect(OWNER).setIdentitesStatesUpdateTime(await time.latest());
    });
  });

  describe("#verify", () => {
    let user: Identity;
    let issuer: Identity;

    let mz: Merklizer;

    let inputs: CredentialAtomicMTPOnChainV2Inputs;
    let out: CredentialAtomicMTPOnChainV2Outputs;

    let points: VerifierHelper.ProofPointsStruct;
    let publicSignals: string[];

    let statesMerkleData: ILightweightState.StatesMerkleDataStruct;

    before("setup", async () => {
      mz = await Merklizer.merklizeJSONLD(TestClaimDocument);
    });

    beforeEach("setup", async () => {
      user = await new Identity(UserPK, IDOwnershipLevels, IDOwnershipLevels, IDOwnershipLevels).postBuild();
      issuer = await new Identity(IssuerPK, IssuerLevels, IssuerLevels, IssuerLevels).postBuild();

      [inputs, out] = await generateMTPData(user, issuer, mz, [], 0n);

      [points, publicSignals] = await getRegisterZKP(inputs, await validator.getAddress(), ethers.ZeroHash);

      statesMerkleData = {
        issuerId: DID.idFromDID(issuer.id).bigInt(),
        issuerState: await issuer.state(),
        createdAtTimestamp: await time.latest(),
        merkleProof: [],
      };

      const newIdentitiesStatesRoot = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [statesMerkleData.issuerId, statesMerkleData.issuerState, statesMerkleData.createdAtTimestamp],
      );
      const gistRootData = {
        root: out.gistRoot,
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(gistRootData, newIdentitiesStatesRoot);

      const signature = SIGNER.signingKey.sign(sigHash);

      const proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await stateContract.signedTransitState(newIdentitiesStatesRoot, gistRootData, proof);
    });

    it("should verify correct ZKP", async () => {
      await validator.verify(statesMerkleData, publicSignals, points.a, points.b, points.c, out.circuitQueryHash);
    });

    it("should revert if ZKP is incorrect", async () => {
      const wrongPoints = deepClone(points);
      wrongPoints.a[0] = ethers.ZeroHash;

      await expect(
        validator.verify(
          statesMerkleData,
          publicSignals,
          wrongPoints.a,
          wrongPoints.b,
          wrongPoints.c,
          out.circuitQueryHash,
        ),
      ).to.be.rejectedWith("QueryValidator: proof is not valid");
    });

    it("should revert if the queryHash is incorrect", async () => {
      await expect(
        validator.verify(statesMerkleData, publicSignals, points.a, points.b, points.c, ethers.ZeroHash),
      ).to.be.rejectedWith("QueryValidator: query hash does not match the requested one");
    });

    it("should revert if different Iden and Rev states are used", async () => {
      const data = await generateMTPData(user, issuer, mz, [], 1n);

      data[0].issuerClaimNonRevState = inputs.issuerClaimNonRevState;
      data[0].issuerClaimNonRevClaimsTreeRoot = inputs.issuerClaimNonRevClaimsTreeRoot;

      const [newPoints, newPublicSignals] = await getRegisterZKP(
        data[0],
        await validator.getAddress(),
        ethers.ZeroHash,
      );

      await expect(
        validator.verify(
          statesMerkleData,
          newPublicSignals,
          newPoints.a,
          newPoints.b,
          newPoints.c,
          data[1].circuitQueryHash,
        ),
      ).to.be.rejectedWith("QueryValidator: only actual states must be used");
    });

    it("should revert if states merkle data is incorrect", async () => {
      const wrongStatesMerkleData = deepClone(statesMerkleData);
      wrongStatesMerkleData.issuerState = 0n;

      await expect(
        validator.verify(wrongStatesMerkleData, publicSignals, points.a, points.b, points.c, out.circuitQueryHash),
      ).to.be.rejectedWith("QueryValidator: invalid issuer data in the states merkle data struct");
    });

    it("should revert if the gistRootData is incorrect", async () => {
      const data = await generateMTPData(
        user,
        issuer,
        mz,
        [
          {
            id: 1n,
            state: 2n,
          },
        ],
        2n,
      );

      const [newPoints, newPublicSignals] = await getRegisterZKP(
        data[0],
        await validator.getAddress(),
        ethers.ZeroHash,
      );

      const clonedStatesMerkleData = deepClone(statesMerkleData);

      clonedStatesMerkleData.issuerState = await issuer.state();

      await expect(
        validator.verify(
          clonedStatesMerkleData,
          newPublicSignals,
          newPoints.a,
          newPoints.b,
          newPoints.c,
          out.circuitQueryHash,
        ),
      ).to.be.rejectedWith("QueryValidator: gist root state isn't in state contract");
    });

    it("should revert if issuer state isn't in state contract", async () => {
      const data = await generateMTPData(user, issuer, mz, [], 3n);

      const [newPoints, newPublicSignals] = await getRegisterZKP(
        data[0],
        await validator.getAddress(),
        ethers.ZeroHash,
      );

      const wrongState = {
        issuerId: DID.idFromDID(issuer.id).bigInt(),
        issuerState: await issuer.state(),
        createdAtTimestamp: await time.latest(),
        merkleProof: [],
      };

      await expect(
        validator.verify(wrongState, newPublicSignals, newPoints.a, newPoints.b, newPoints.c, out.circuitQueryHash),
      ).to.be.rejectedWith("QueryValidator: issuer state does not exist in the state contract");
    });

    async function transitState() {
      await generateMTPData(user, issuer, mz, [], 3n);

      const newStatesMerkleData = {
        issuerId: DID.idFromDID(issuer.id).bigInt(),
        issuerState: await issuer.state(),
        createdAtTimestamp: await time.latest(),
        merkleProof: [],
      };

      const newIdentitiesStatesRoot = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [newStatesMerkleData.issuerId, newStatesMerkleData.issuerState, newStatesMerkleData.createdAtTimestamp],
      );
      const newGistRootData = {
        root: ethers.ZeroHash,
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(newGistRootData, newIdentitiesStatesRoot);

      const signature = SIGNER.signingKey.sign(sigHash);

      const proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await stateContract.signedTransitState(newIdentitiesStatesRoot, newGistRootData, proof);
    }

    it("should revert if claim is expired", async () => {
      await transitState();

      await time.increase(IDENTITES_STATES_UPDATE_TIME);

      await expect(
        validator.verify(statesMerkleData, publicSignals, points.a, points.b, points.c, out.circuitQueryHash),
      ).to.be.rejectedWith("QueryValidator: identites states update time has expired");
    });

    it("should pass if claim is not expired", async () => {
      await transitState();

      await time.increase(IDENTITES_STATES_UPDATE_TIME / 60);

      await expect(
        validator.verify(statesMerkleData, publicSignals, points.a, points.b, points.c, out.circuitQueryHash),
      ).to.be.eventually.fulfilled;
    });
  });

  describe("#authorizeUpgrade", () => {
    it("should authorize upgrade only by owner", async () => {
      await expect(validator.connect(FIRST).upgradeTo(ethers.ZeroAddress)).to.be.rejectedWith(
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

  describe("#getters", () => {
    it("should get circuit id, user id and challenge", async () => {
      expect(await validator.getCircuitId()).to.be.equal("credentialAtomicQueryMTPV2OnChainVoting");
      expect(await validator.getUserIdIndex()).to.be.equal(1);
      expect(await validator.getChallengeInputIndex()).to.be.equal(4);
    });
  });
});

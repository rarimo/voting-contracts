import { expect } from "chai";
import { ethers } from "hardhat";

import { DID } from "@iden3/js-iden3-core";
import { Merklizer } from "@iden3/js-jsonld-merklization";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { deepClone, IMPLEMENTATION_SLOT, REGISTRATION_CLAIM_SCHEMA_ID } from "@scripts";

import {
  UserPK,
  Reverter,
  Identity,
  IssuerPK,
  Operator,
  poseidonHash,
  IssuerLevels,
  getRegisterZKP,
  IDOwnershipLevels,
  deployPoseidonFacade,
  generateRegistrationData,
  CredentialAtomicMTPOnChainV2Outputs,
  CredentialAtomicMTPOnChainV2Inputs,
  setUpRegistrationDocument,
} from "@test-helpers";

import {
  ILightweightState,
  LightweightState,
  PoseidonFacade,
  PoseidonUnit3L,
  QueryMTPValidator,
  RegisterVerifier,
  ZKPQueriesStorage,
} from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/core/Voting";
import { IBaseVerifier } from "@/generated-types/contracts/core/Registration";
import { IZKPQueriesStorage } from "@/generated-types/contracts/iden3/ZKPQueriesStorage";
import { IRegisterVerifier } from "@/generated-types/contracts/iden3/verifiers/RegisterVerifier";

describe("RegisterVerifier", () => {
  const reverter = new Reverter();

  const IDENTITES_STATES_UPDATE_TIME = 60 * 60;

  const ZKP_QUERY_ID = "REGISTER_PROOF";

  const ZKP_QUERY_INFO: IZKPQueriesStorage.QueryInfoStruct = {
    queryValidator: ethers.ZeroAddress,
    circuitId: "credentialAtomicQueryMTPV2OnChainVoting",
    circuitQuery: {
      schema: REGISTRATION_CLAIM_SCHEMA_ID,
      slotIndex: 0,
      operator: Operator.EQ,
      claimPathKey: 7149981159332146589513683923839673175152485888476941863507542541133469121095n,
      claimPathNotExists: 0n,
      values: ["0"],
    },
  };

  let proofParamsStruct: IRegisterVerifier.RegisterProofInfoStruct = {
    registrationContractAddress: ethers.ZeroAddress,
    registerProofParams: {
      issuingAuthority: poseidonHash("0x01"),
      commitment: poseidonHash("0x02"),
      documentNullifier: poseidonHash("0x03"),
    },
  };

  let proveIdentityParams: IBaseVerifier.ProveIdentityParamsStruct = {
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

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SIGNER: HDNodeWallet;

  let validator: QueryMTPValidator;
  let stateContract: LightweightState;

  let zkpQueriesStorage: ZKPQueriesStorage;
  let poseidonFacade: PoseidonFacade;

  let registerVerifier: RegisterVerifier;
  let poseidon3L: PoseidonUnit3L;

  before("setup", async () => {
    [OWNER, FIRST] = await ethers.getSigners();

    const LightweightState = await ethers.getContractFactory("LightweightState");
    stateContract = await LightweightState.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    let proxy = await Proxy.deploy(await stateContract.getAddress(), "0x");

    stateContract = stateContract.attach(await proxy.getAddress()) as LightweightState;

    SIGNER = ethers.Wallet.createRandom() as any;

    await stateContract.__LightweightState_init(SIGNER.address, ethers.ZeroAddress, "chain", "sourceChain");

    const RegistrationVerifier = await ethers.getContractFactory("GeneratedRegistrationVerifier");
    const registrationVerifier = await RegistrationVerifier.deploy();

    const QueryMTPValidator = await ethers.getContractFactory("QueryMTPValidator");
    validator = await QueryMTPValidator.deploy();

    proxy = await Proxy.deploy(await validator.getAddress(), "0x");
    validator = validator.attach(await proxy.getAddress()) as QueryMTPValidator;

    await validator.__QueryMTPValidator_init(
      await registrationVerifier.getAddress(),
      await stateContract.getAddress(),
      IDENTITES_STATES_UPDATE_TIME,
    );

    const hashersDeployment = await deployPoseidonFacade();
    poseidonFacade = hashersDeployment.poseidonFacade;
    poseidon3L = hashersDeployment.poseidonContracts[2] as PoseidonUnit3L;

    const ZKPQueriesStorage = await ethers.getContractFactory("ZKPQueriesStorage", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    zkpQueriesStorage = await ZKPQueriesStorage.deploy();

    proxy = await Proxy.deploy(await zkpQueriesStorage.getAddress(), "0x");
    zkpQueriesStorage = zkpQueriesStorage.attach(await proxy.getAddress()) as ZKPQueriesStorage;

    await zkpQueriesStorage.__ZKPQueriesStorage_init(await stateContract.getAddress());

    const RegisterVerifier = await ethers.getContractFactory("RegisterVerifier", {
      libraries: {
        PoseidonUnit3L: await poseidon3L.getAddress(),
      },
    });
    registerVerifier = await RegisterVerifier.deploy();

    proxy = await Proxy.deploy(await registerVerifier.getAddress(), "0x");
    registerVerifier = registerVerifier.attach(await proxy.getAddress()) as RegisterVerifier;

    await registerVerifier.__RegisterVerifier_init(
      await zkpQueriesStorage.getAddress(),
      [proofParamsStruct.registerProofParams.issuingAuthority],
      [],
    );

    // Set up

    ZKP_QUERY_INFO.queryValidator = await validator.getAddress();
    await zkpQueriesStorage.setZKPQuery(ZKP_QUERY_ID, ZKP_QUERY_INFO);

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  describe("#access", () => {
    it("should not initialize twice", async () => {
      await expect(
        registerVerifier.__RegisterVerifier_init(await zkpQueriesStorage.getAddress(), [], []),
      ).to.be.rejectedWith("Initializable: contract is already initialized");
    });

    it("should revert if trying to call inner initializer", async () => {
      const RegisterVerifierMock = await ethers.getContractFactory("RegisterVerifierMock", {
        libraries: {
          PoseidonUnit3L: await poseidon3L.getAddress(),
        },
      });
      const registerVerifierMock = await RegisterVerifierMock.deploy();

      await expect(registerVerifierMock.__BaseVerifierMock_init(ethers.ZeroAddress)).to.be.rejectedWith(
        "Initializable: contract is not initializing",
      );
    });
  });

  describe("#issuer-management", () => {
    it("should set ZKPQueriesStorage only by owner", async () => {
      await expect(registerVerifier.connect(FIRST).setZKPQueriesStorage(ethers.ZeroAddress)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await registerVerifier.connect(OWNER).setZKPQueriesStorage(ethers.ZeroAddress);
    });

    it("should set identites states update time only by owner", async () => {
      await expect(registerVerifier.connect(FIRST).updateAllowedIssuers(1, [1], true)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await registerVerifier.connect(OWNER).updateAllowedIssuers(1, [1], true);

      expect(await registerVerifier.getAllowedIssuers(1)).to.be.deep.equal([1]);
      expect(await registerVerifier.isAllowedIssuer(1, 1)).to.be.true;
    });

    it("should remove allowed issuer only by owner", async () => {
      await registerVerifier.connect(OWNER).updateAllowedIssuers(1, [1], true);

      await registerVerifier.connect(OWNER).updateAllowedIssuers(1, [1], false);
    });
  });

  describe("#issuing-authority-getters", () => {
    let anotherRegisterVerifier: RegisterVerifier;

    const whitelist = [1, 2, 3];
    const blacklist = [3, 5];

    beforeEach("setup", async () => {
      const RegisterVerifier = await ethers.getContractFactory("RegisterVerifier", {
        libraries: {
          PoseidonUnit3L: await poseidon3L.getAddress(),
        },
      });
      anotherRegisterVerifier = await RegisterVerifier.deploy();

      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      let proxy = await Proxy.deploy(await anotherRegisterVerifier.getAddress(), "0x");

      anotherRegisterVerifier = anotherRegisterVerifier.attach(await proxy.getAddress()) as RegisterVerifier;

      await anotherRegisterVerifier.__RegisterVerifier_init(await zkpQueriesStorage.getAddress(), whitelist, blacklist);
    });

    it("should correctly manage whitelisted/blacklisted issuerAuthorities", async () => {
      expect(await anotherRegisterVerifier.countIssuingAuthorityWhitelist()).to.be.equal(whitelist.length);
      expect(await anotherRegisterVerifier.countIssuingAuthorityBlacklist()).to.be.equal(blacklist.length);

      expect(await anotherRegisterVerifier.isIssuingAuthorityWhitelisted(whitelist[0])).to.be.true;
      expect(await anotherRegisterVerifier.isIssuingAuthorityBlacklisted(blacklist[0])).to.be.true;

      expect(await anotherRegisterVerifier.listIssuingAuthorityWhitelist(0, 5)).to.be.deep.equal(whitelist);
      expect(await anotherRegisterVerifier.listIssuingAuthorityBlacklist(0, 5)).to.be.deep.equal(blacklist);
    });

    it("should revert if trying to prove identity if issuer is blacklisted", async () => {
      const copyOfProofParamsStruct = deepClone(proofParamsStruct);

      copyOfProofParamsStruct.registrationContractAddress = await OWNER.getAddress();
      copyOfProofParamsStruct.registerProofParams.issuingAuthority = blacklist[0];

      await expect(
        anotherRegisterVerifier.proveRegistration(proveIdentityParams, copyOfProofParamsStruct),
      ).to.be.rejectedWith("RegisterVerifier: Issuing authority is blacklisted.");
    });

    it("should revert if whitelist is not empty and issuer is not whitelisted", async () => {
      const copyOfProofParamsStruct = deepClone(proofParamsStruct);

      copyOfProofParamsStruct.registrationContractAddress = await OWNER.getAddress();
      copyOfProofParamsStruct.registerProofParams.issuingAuthority = 4;

      await expect(
        anotherRegisterVerifier.proveRegistration(proveIdentityParams, copyOfProofParamsStruct),
      ).to.be.rejectedWith("RegisterVerifier: Issuing authority is not whitelisted.");
    });
  });

  describe("#proveIdentity", () => {
    let user: Identity;
    let issuer: Identity;

    let inputs: CredentialAtomicMTPOnChainV2Inputs;
    let out: CredentialAtomicMTPOnChainV2Outputs;

    let points: VerifierHelper.ProofPointsStruct;
    let publicSignals: string[];

    let statesMerkleData: ILightweightState.StatesMerkleDataStruct;

    let transitStateParams: IBaseVerifier.TransitStateParamsStruct = {
      newIdentitiesStatesRoot: ethers.ZeroHash,
      gistData: {
        root: ethers.ZeroHash,
        createdAtTimestamp: 0,
      },
      proof: "0x",
    };

    let mz: Merklizer;

    beforeEach("setup", async () => {
      user = await new Identity(UserPK, IDOwnershipLevels, IDOwnershipLevels, IDOwnershipLevels).postBuild();
      issuer = await new Identity(IssuerPK, IssuerLevels, IssuerLevels, IssuerLevels).postBuild();

      mz = await Merklizer.merklizeJSONLD(
        setUpRegistrationDocument(
          user,
          issuer,
          BigInt(proofParamsStruct.registerProofParams.issuingAuthority),
          BigInt(proofParamsStruct.registerProofParams.documentNullifier),
        ),
      );

      proofParamsStruct.registrationContractAddress = await OWNER.getAddress();

      [inputs, out] = await generateRegistrationData(user, issuer, mz, 0n);

      [points, publicSignals] = await getRegisterZKP(
        inputs,
        String(proofParamsStruct.registrationContractAddress),
        String(proofParamsStruct.registerProofParams.commitment),
      );

      proveIdentityParams.inputs = publicSignals;
      proveIdentityParams.a = points.a;
      proveIdentityParams.b = points.b;
      proveIdentityParams.c = points.c;

      statesMerkleData = {
        issuerId: DID.idFromDID(issuer.id).bigInt(),
        issuerState: await issuer.state(),
        createdAtTimestamp: await time.latest(),
        merkleProof: [],
      };

      proveIdentityParams.statesMerkleData = deepClone(statesMerkleData);

      transitStateParams.newIdentitiesStatesRoot = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [statesMerkleData.issuerId, statesMerkleData.issuerState, statesMerkleData.createdAtTimestamp],
      );
      transitStateParams.gistData = {
        root: out.gistRoot,
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(
        transitStateParams.gistData,
        transitStateParams.newIdentitiesStatesRoot,
      );

      const signature = SIGNER.signingKey.sign(sigHash);

      transitStateParams.proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await registerVerifier.updateAllowedIssuers(
        ZKP_QUERY_INFO.circuitQuery.schema,
        [DID.idFromDID(issuer.id).bigInt()],
        true,
      );
    });

    it("should revert if the votingAddress is not a msg.sender", async () => {
      const wrongProofParamsStruct = deepClone(proofParamsStruct);
      wrongProofParamsStruct.registrationContractAddress = await FIRST.getAddress();

      await expect(
        registerVerifier.transitStateAndProveRegistration(
          proveIdentityParams,
          wrongProofParamsStruct,
          transitStateParams,
        ),
      ).to.be.rejectedWith("RegisterVerifier: the caller is not the voting contract.");

      await expect(registerVerifier.proveRegistration(proveIdentityParams, wrongProofParamsStruct)).to.be.rejectedWith(
        "RegisterVerifier: the caller is not the voting contract.",
      );
    });

    it("should transit state and prove identity", async () => {
      await registerVerifier.transitStateAndProveRegistration(
        proveIdentityParams,
        proofParamsStruct,
        transitStateParams,
      );

      const identityInfo = await registerVerifier.getRegisterProofInfo(
        proofParamsStruct.registrationContractAddress,
        proofParamsStruct.registerProofParams.documentNullifier,
      );
      expect(identityInfo.registrationContractAddress).to.be.equal(proofParamsStruct.registrationContractAddress);
      expect(identityInfo.registerProofParams.issuingAuthority).to.be.equal(
        proofParamsStruct.registerProofParams.issuingAuthority,
      );
      expect(identityInfo.registerProofParams.commitment).to.be.equal(proofParamsStruct.registerProofParams.commitment);
      expect(identityInfo.registerProofParams.documentNullifier).to.be.equal(
        proofParamsStruct.registerProofParams.documentNullifier,
      );

      expect(
        await registerVerifier.isIdentityRegistered(
          proofParamsStruct.registrationContractAddress,
          proofParamsStruct.registerProofParams.documentNullifier,
        ),
      ).to.be.true;
    });

    it("should revert if trying to vote twice, but should handle same state transition", async () => {
      await registerVerifier.transitStateAndProveRegistration(
        proveIdentityParams,
        proofParamsStruct,
        transitStateParams,
      );

      await expect(
        registerVerifier.transitStateAndProveRegistration(proveIdentityParams, proofParamsStruct, transitStateParams),
      ).to.be.rejectedWith("RegisterVerifier: Identity is already registered.");
    });

    it("should prove identity and transit state in different transactions", async () => {
      await stateContract.signedTransitState(
        transitStateParams.newIdentitiesStatesRoot,
        transitStateParams.gistData,
        transitStateParams.proof,
      );

      await registerVerifier.proveRegistration(proveIdentityParams, proofParamsStruct);
    });

    it("should revert if trying to prove identity without transit state", async () => {
      const newStatesMerkleData = {
        issuerId: DID.idFromDID(issuer.id).bigInt(),
        issuerState: ethers.id("0x01"),
        createdAtTimestamp: await time.latest(),
        merkleProof: [],
      };

      const packedHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [newStatesMerkleData.issuerId, newStatesMerkleData.issuerState, newStatesMerkleData.createdAtTimestamp],
      );
      const gistData = {
        root: out.gistRoot,
        createdAtTimestamp: await time.latest(),
      };

      const sigHash = await stateContract.getSignHash(gistData, packedHash);

      const signature = SIGNER.signingKey.sign(sigHash);

      const proof = new ethers.AbiCoder().encode(["bytes32[]", "bytes"], [[], signature.serialized]);

      await stateContract.signedTransitState(packedHash, gistData, proof);

      await expect(registerVerifier.proveRegistration(proveIdentityParams, proofParamsStruct)).to.be.rejectedWith(
        "QueryValidator: issuer state does not exist in the state contract",
      );
    });

    it("should revert if ZKP query does not exist", async () => {
      await zkpQueriesStorage.removeZKPQuery(ZKP_QUERY_ID);

      await expect(
        registerVerifier.transitStateAndProveRegistration(proveIdentityParams, proofParamsStruct, transitStateParams),
      ).to.be.rejectedWith("RegisterVerifier: ZKP Query does not exist for passed query id.");
    });

    it("should revert if commitment is not the same as in inputs", async () => {
      const wrongProofParamsStruct = deepClone(proofParamsStruct);

      wrongProofParamsStruct.registerProofParams.commitment = poseidonHash("0x04");

      await expect(
        registerVerifier.transitStateAndProveRegistration(
          proveIdentityParams,
          wrongProofParamsStruct,
          transitStateParams,
        ),
      ).to.be.rejectedWith("RegisterVerifier: commitment does not match the requested one.");
    });

    it("should revert if voting address is not the same as in inputs", async () => {
      const wrongProveIdentityParams = deepClone(proveIdentityParams);

      wrongProveIdentityParams.inputs[11] = BigInt(ethers.toBeHex(await FIRST.getAddress(), 32));

      await expect(
        registerVerifier.transitStateAndProveRegistration(
          wrongProveIdentityParams,
          proofParamsStruct,
          transitStateParams,
        ),
      ).to.be.rejectedWith("RegisterVerifier: registration address does not match the requested one.");
    });

    it("should revert if issuer is not allowed", async () => {
      await registerVerifier.updateAllowedIssuers(
        ZKP_QUERY_INFO.circuitQuery.schema,
        [DID.idFromDID(issuer.id).bigInt()],
        false,
      );

      await expect(
        registerVerifier.transitStateAndProveRegistration(proveIdentityParams, proofParamsStruct, transitStateParams),
      ).to.be.rejectedWith("BaseVerifier: Issuer is not on the list of allowed issuers.");
    });
  });

  describe("#authorizeUpgrade", () => {
    it("should authorize upgrade only by owner", async () => {
      await expect(registerVerifier.connect(FIRST).upgradeTo(ethers.ZeroAddress)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      const RegisterVerifier = await ethers.getContractFactory("RegisterVerifier", {
        libraries: {
          PoseidonUnit3L: await poseidon3L.getAddress(),
        },
      });
      const newImplementation = await RegisterVerifier.deploy();

      await registerVerifier.upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await registerVerifier.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

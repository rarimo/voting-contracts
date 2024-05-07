import { expect } from "chai";
import { ethers } from "hardhat";

import { DID } from "@iden3/js-iden3-core";
import { poseidon } from "@iden3/js-crypto";
import { Merklizer } from "@iden3/js-jsonld-merklization";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { time } from "@nomicfoundation/hardhat-network-helpers";

import { deepClone, REGISTRATION_CLAIM_SCHEMA_ID, RegistrationStatus } from "@scripts";

import {
  getPoseidon,
  poseidonHash,
  Reverter,
  Identity,
  CredentialAtomicMTPOnChainV2Inputs,
  CredentialAtomicMTPOnChainV2Outputs,
  UserPK,
  IDOwnershipLevels,
  IssuerPK,
  IssuerLevels,
  generateRegistrationData,
  getRegisterZKP,
  Operator,
  deployPoseidonFacade,
  setUpRegistrationDocument,
} from "@test-helpers";

import {
  ILightweightState,
  IRegistration,
  LightweightState,
  PoseidonUnit3L,
  QueryMTPValidator,
  RegisterVerifier,
  Registration,
  ZKPQueriesStorage,
} from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/core/Voting";
import { IBaseVerifier } from "@/generated-types/contracts/core/Registration";
import { IZKPQueriesStorage } from "@/generated-types/contracts/iden3/ZKPQueriesStorage";
import { IRegisterVerifier } from "@/generated-types/contracts/iden3/verifiers/RegisterVerifier";

describe("Registration", () => {
  const reverter = new Reverter();

  const IDENTITES_STATES_UPDATE_TIME = 60 * 60;

  const ZKP_QUERY_ID = "REGISTER_PROOF";

  const ZKP_QUERY_INFO: IZKPQueriesStorage.QueryInfoStruct = {
    queryValidator: ethers.ZeroAddress,
    circuitId: "credentialAtomicQueryMTPV2OnChainRegistration",
    circuitQuery: {
      schema: REGISTRATION_CLAIM_SCHEMA_ID,
      slotIndex: 0,
      operator: Operator.EQ,
      claimPathKey: 7149981159332146589513683923839673175152485888476941863507542541133469121095n,
      claimPathNotExists: 0n,
      values: ["0"],
    },
  };

  let SIGNER: HDNodeWallet;

  let validator: QueryMTPValidator;
  let stateContract: LightweightState;
  let zkpQueriesStorage: ZKPQueriesStorage;
  let registerVerifier: RegisterVerifier;

  let registration: Registration;

  let treeHeight = 80n;

  let defaultRegistrationParams: IRegistration.RegistrationParamsStruct = {
    remark: "Registration remark",
    commitmentStart: 0,
    commitmentPeriod: 60,
  };

  before("setup", async () => {
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
    const poseidonFacade = hashersDeployment.poseidonFacade;
    const poseidon3L = hashersDeployment.poseidonContracts[2] as PoseidonUnit3L;

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

    await registerVerifier.__RegisterVerifier_init(await zkpQueriesStorage.getAddress(), [], []);

    ZKP_QUERY_INFO.queryValidator = await validator.getAddress();
    await zkpQueriesStorage.setZKPQuery(ZKP_QUERY_ID, ZKP_QUERY_INFO);

    const Registration = await ethers.getContractFactory("Registration", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    registration = await Registration.deploy(await registerVerifier.getAddress(), treeHeight);

    proxy = await Proxy.deploy(await registration.getAddress(), "0x");
    registration = registration.attach(await proxy.getAddress()) as Registration;

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      const registrationParams = {
        ...deepClone(defaultRegistrationParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await registration.__Registration_init(registrationParams);

      await expect(registration.__Registration_init(registrationParams)).to.be.rejectedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#initialize", () => {
    it("should correctly initialize the contract", async () => {
      const registrationParams = {
        ...deepClone(defaultRegistrationParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await registration.__Registration_init(registrationParams);

      const actualRegistrationParams = await registration.getRegistrationInfo();
      expect(actualRegistrationParams.remark).to.equal(registrationParams.remark);
      expect(actualRegistrationParams["1"].commitmentStartTime).to.equal(registrationParams.commitmentStart);
      expect(actualRegistrationParams["1"].commitmentEndTime).to.equal(
        BigInt(registrationParams.commitmentStart) + BigInt(registrationParams.commitmentPeriod),
      );
      expect(await registration.smtTreeMaxDepth()).to.equal(treeHeight);

      expect(await registration.registerVerifier()).to.equal(await registerVerifier.getAddress());
    });

    it("should revert if commitment start is in the past", async () => {
      const registrationParams = {
        ...deepClone(defaultRegistrationParams),
        commitmentStart: 0,
      };

      await expect(registration.__Registration_init(registrationParams)).to.be.rejectedWith(
        "Registration: commitment start must be in the future",
      );
    });

    it("should revert if commitment period is 0", async () => {
      const registrationParams = {
        ...deepClone(defaultRegistrationParams),
        commitmentStart: (await time.latest()) + 60,
        commitmentPeriod: 0,
      };

      await expect(registration.__Registration_init(registrationParams)).to.be.rejectedWith(
        "Registration: commitment period must be greater than 0",
      );
    });
  });

  describe("#registerForRegistration -- ZKP involved tests", () => {
    let commitmentStartTimestamp: number;

    let user: Identity;
    let issuer: Identity;

    let inputs: CredentialAtomicMTPOnChainV2Inputs;
    let out: CredentialAtomicMTPOnChainV2Outputs;

    let points: VerifierHelper.ProofPointsStruct;
    let publicSignals: string[];

    let statesMerkleData: ILightweightState.StatesMerkleDataStruct;

    let proofParamsStruct: IRegisterVerifier.RegisterProofParamsStruct = {
      issuingAuthority: poseidonHash("0x01"),
      commitment: poseidonHash("0x02"),
      documentNullifier: poseidonHash(ethers.hexlify(ethers.randomBytes(32))),
    };

    let transitStateParams: IBaseVerifier.TransitStateParamsStruct = {
      newIdentitiesStatesRoot: ethers.ZeroHash,
      gistData: {
        root: ethers.ZeroHash,
        createdAtTimestamp: 0,
      },
      proof: "0x",
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

    let mz: Merklizer;

    beforeEach("setup", async () => {
      user = await new Identity(UserPK, IDOwnershipLevels, IDOwnershipLevels, IDOwnershipLevels).postBuild();
      issuer = await new Identity(IssuerPK, IssuerLevels, IssuerLevels, IssuerLevels).postBuild();

      mz = await Merklizer.merklizeJSONLD(
        setUpRegistrationDocument(
          user,
          issuer,
          BigInt(proofParamsStruct.issuingAuthority),
          BigInt(proofParamsStruct.documentNullifier),
        ),
      );

      [inputs, out] = await generateRegistrationData(user, issuer, mz, 0n);

      [points, publicSignals] = await getRegisterZKP(
        inputs,
        String(ethers.toBeHex(await registration.getAddress(), 32)),
        String(proofParamsStruct.commitment),
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

      const stateHash = await stateContract.getSignHash(
        transitStateParams.gistData,
        transitStateParams.newIdentitiesStatesRoot,
      );

      const randomMerkleProof = new Array(32)
        .fill(ethers.ZeroHash)
        .map((_, i) => ethers.hexlify(ethers.randomBytes(32)));

      const getMerkelRoot = (proof: string[], leaf: string) => {
        let computedHash = leaf;
        for (let i = 0; i < proof.length; i++) {
          const proofElement = proof[i];
          if (computedHash <= proofElement) {
            computedHash = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [computedHash, proofElement]);
          } else {
            computedHash = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [proofElement, computedHash]);
          }
        }
        return computedHash;
      };

      const merkleRoot = getMerkelRoot(randomMerkleProof, stateHash);

      const signature = SIGNER.signingKey.sign(merkleRoot);

      transitStateParams.proof = new ethers.AbiCoder().encode(
        ["bytes32[]", "bytes"],
        [randomMerkleProof, signature.serialized],
      );

      await registerVerifier.updateAllowedIssuers(
        ZKP_QUERY_INFO.circuitQuery.schema,
        [DID.idFromDID(issuer.id).bigInt()],
        true,
      );

      commitmentStartTimestamp = (await time.latest()) + 60;

      await registration.__Registration_init({
        ...deepClone(defaultRegistrationParams),
        commitmentStart: commitmentStartTimestamp,
      });

      await time.increaseTo(commitmentStartTimestamp);
    });

    it("should revert if trying to register not during the commitment period", async () => {
      await time.increase(commitmentStartTimestamp);

      await expect(
        registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, false),
      ).to.be.rejectedWith("Registration: the registration must be in the commitment state");
    });

    it("should revert if commitment was already used", async () => {
      await registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, true);

      expect(await registration.isRootExists(await registration.getRoot())).to.be.true;

      await expect(
        registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, false),
      ).to.be.rejectedWith("Registration: commitment already exists");
    });

    it("should register with state transition and ZKP proof", async () => {
      await expect(
        registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, false),
      ).to.be.rejectedWith("QueryValidator: gist root state isn't in state contract");

      await registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, true);
    });

    it("should register with already existing state transition and ZKP proof", async () => {
      await stateContract.signedTransitState(
        transitStateParams.newIdentitiesStatesRoot,
        transitStateParams.gistData,
        transitStateParams.proof,
      );

      await registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, false);
    });

    it("should register for parallel registrations", async () => {
      const Registration = await ethers.getContractFactory("Registration", {
        libraries: {
          PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      let anotherRegistration: Registration = await Registration.deploy(
        await registerVerifier.getAddress(),
        treeHeight,
      );

      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      let proxy = await Proxy.deploy(await anotherRegistration.getAddress(), "0x");

      anotherRegistration = anotherRegistration.attach(await proxy.getAddress()) as Registration;

      const commitmentStartTimestampFor2Reg = (await time.latest()) + 10;

      await anotherRegistration.__Registration_init({
        ...deepClone(defaultRegistrationParams),
        commitmentStart: commitmentStartTimestampFor2Reg,
      });
      await time.increaseTo(commitmentStartTimestampFor2Reg);

      await registration.register(proveIdentityParams, proofParamsStruct, transitStateParams, true);

      [points, publicSignals] = await getRegisterZKP(
        inputs,
        String(ethers.toBeHex(await anotherRegistration.getAddress(), 32)),
        String(proofParamsStruct.commitment),
      );

      proveIdentityParams.inputs = publicSignals;
      proveIdentityParams.a = points.a;
      proveIdentityParams.b = points.b;
      proveIdentityParams.c = points.c;

      await anotherRegistration.register(proveIdentityParams, proofParamsStruct, transitStateParams, true);

      const documentNullifier = proofParamsStruct.documentNullifier;
      expect(await registration.isUserRegistered(documentNullifier)).to.be.true;
      expect(await anotherRegistration.isUserRegistered(documentNullifier)).to.be.true;
    });

    it("should revert if trying to register with zero commitment", async () => {
      const copyOfProofParamsStruct = deepClone(proofParamsStruct);
      copyOfProofParamsStruct.commitment = ethers.ZeroHash;

      [points, publicSignals] = await getRegisterZKP(
        inputs,
        String(ethers.toBeHex(await registration.getAddress(), 32)),
        ethers.ZeroHash,
      );

      proveIdentityParams.inputs = publicSignals;
      proveIdentityParams.a = points.a;
      proveIdentityParams.b = points.b;
      proveIdentityParams.c = points.c;

      await expect(
        registration.register(proveIdentityParams, copyOfProofParamsStruct, transitStateParams, true),
      ).to.be.rejectedWith("RegisterVerifier: commitment should not be zero");
    });
  });

  describe("#getRegistrationStatus", () => {
    it("should return correct proposal status", async () => {
      expect(await registration.getRegistrationStatus()).to.equal(RegistrationStatus.NONE);

      await registration.__Registration_init({
        ...deepClone(defaultRegistrationParams),
        commitmentStart: (await time.latest()) + 300,
      });

      expect(await registration.getRegistrationStatus()).to.equal(RegistrationStatus.NOT_STARTED);

      const registrationInfo = await registration.getRegistrationInfo();

      await time.increaseTo(Number(registrationInfo["1"].commitmentStartTime));

      expect(await registration.getRegistrationStatus()).to.equal(RegistrationStatus.COMMITMENT);

      await time.increase(Number(defaultRegistrationParams.commitmentPeriod));

      expect(await registration.getRegistrationStatus()).to.equal(RegistrationStatus.ENDED);
    });
  });

  describe("#coverage", () => {
    it("should add multiple elements to tree, and get node by key", async () => {
      const PoseidonSMTMock = await ethers.getContractFactory("PoseidonSMTMock", {
        libraries: {
          PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const poseidonSMTMock = await PoseidonSMTMock.deploy();

      await poseidonSMTMock.__PoseidonSMTMock_init(treeHeight);

      const element = ethers.toBeHex("1", 32);

      await poseidonSMTMock.add(element);
      await poseidonSMTMock.add(ethers.toBeHex("3", 32));
      await poseidonSMTMock.add(ethers.toBeHex("7", 32));

      const elementIndex = poseidon.hash([BigInt(element)]);

      const node = await poseidonSMTMock.getNodeByKey("0x" + elementIndex.toString(16));

      expect(node.key).to.equal(elementIndex);
      expect(node.value).to.equal(element);
    });
  });
});

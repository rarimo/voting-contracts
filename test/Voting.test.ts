import { expect } from "chai";
import { ethers } from "hardhat";

import { DID } from "@iden3/js-iden3-core";
import { poseidon } from "@iden3/js-crypto";

import { HDNodeWallet } from "ethers/src.ts/wallet/hdwallet";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { deepClone, VotingStatus } from "@scripts";

import {
  getPoseidon,
  poseidonHash,
  Reverter,
  generateSecrets,
  getCommitment,
  getVoteZKP,
  SecretPair,
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
} from "@test-helpers";

import {
  ILightweightState,
  IVoting,
  LightweightState,
  PoseidonUnit3L,
  QueryMTPValidator,
  RegisterVerifier,
  VoteVerifier,
  VotingMock,
  ZKPQueriesStorage,
} from "@ethers-v6";
import { VerifierHelper } from "@/generated-types/contracts/Voting";
import { IBaseVerifier } from "@/generated-types/contracts/mock/VotingMock";
import { IRegisterVerifier } from "@/generated-types/contracts/iden3/verifiers/RegisterVerifier";
import { IZKPQueriesStorage } from "@/generated-types/contracts/iden3/ZKPQueriesStorage";

describe("Voting", () => {
  const reverter = new Reverter();

  const IDENTITES_STATES_UPDATE_TIME = 60 * 60;

  const ZKP_QUERY_ID = "REGISTER_PROOF";

  const ZKP_QUERY_INFO: IZKPQueriesStorage.QueryInfoStruct = {
    queryValidator: ethers.ZeroAddress,
    circuitId: "credentialAtomicQueryMTPV2OnChainVoting",
    circuitQuery: {
      schema: "31584121850720233142680868736086212256",
      slotIndex: 6,
      operator: Operator.EQ,
      claimPathKey: 0n,
      claimPathNotExists: 0n,
      values: ["0"],
    },
  };

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SIGNER: HDNodeWallet;

  let validator: QueryMTPValidator;
  let stateContract: LightweightState;
  let zkpQueriesStorage: ZKPQueriesStorage;
  let registerVerifier: RegisterVerifier;

  let voting: VotingMock;
  let votingVerifier: VoteVerifier;

  let treeHeight = 80n;

  let defaultVotingParams: IVoting.VotingParamsStruct = {
    remark: "Voting remark",
    commitmentStart: 0,
    commitmentPeriod: 60,
    votingPeriod: 60,
    candidates: [],
  };

  let defaultProveIdentityParams: IBaseVerifier.ProveIdentityParamsStruct = {
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

  let defaultTransitionStateParams: IBaseVerifier.TransitStateParamsStruct = {
    newIdentitiesStatesRoot: ethers.ZeroHash,
    gistData: {
      root: ethers.ZeroHash,
      createdAtTimestamp: 0,
    },
    proof: "0x",
  };

  let defaultRegisterVerifierParams: IRegisterVerifier.RegisterProofParamsStruct = {
    issuingAuthority: ethers.ZeroHash,
    commitment: ethers.ZeroHash,
    documentNullifier: ethers.ZeroHash,
  };

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
    const poseidonFacade = hashersDeployment.poseidonFacade;
    const poseidon3L = hashersDeployment.poseidonContracts[2] as PoseidonUnit3L;

    const ZKPQueriesStorage = await ethers.getContractFactory("ZKPQueriesStorage", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    zkpQueriesStorage = await ZKPQueriesStorage.deploy();

    await zkpQueriesStorage.__ZKPQueriesStorage_init(await stateContract.getAddress());

    const RegisterVerifier = await ethers.getContractFactory("RegisterVerifier", {
      libraries: {
        PoseidonUnit3L: await poseidon3L.getAddress(),
      },
    });
    registerVerifier = await RegisterVerifier.deploy();

    proxy = await Proxy.deploy(await registerVerifier.getAddress(), "0x");
    registerVerifier = registerVerifier.attach(await proxy.getAddress()) as RegisterVerifier;

    await registerVerifier.__RegisterVerifier_init(await zkpQueriesStorage.getAddress());

    ZKP_QUERY_INFO.queryValidator = await validator.getAddress();
    await zkpQueriesStorage.setZKPQuery(ZKP_QUERY_ID, ZKP_QUERY_INFO);

    defaultVotingParams.candidates = [ethers.toBeHex(OWNER.address, 32)];

    const VotingVerifier = await ethers.getContractFactory("VoteVerifier");
    votingVerifier = await VotingVerifier.deploy();

    const Voting = await ethers.getContractFactory("VotingMock", {
      libraries: {
        PoseidonUnit1L: await (await getPoseidon(1)).getAddress(),
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    voting = await Voting.deploy(await votingVerifier.getAddress(), await registerVerifier.getAddress(), treeHeight);

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  describe("#access", () => {
    it("should not initialize the contract twice", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });

  describe("#initialize", () => {
    it("should correctly initialize the contract", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      };

      await voting.__Voting_init(votingParams);

      const actualVotingParams = await voting.votingInfo();
      expect(actualVotingParams.remark).to.equal(votingParams.remark);
      expect(actualVotingParams["1"].commitmentStartTime).to.equal(votingParams.commitmentStart);
      expect(actualVotingParams["1"].votingStartTime).to.equal(
        BigInt(votingParams.commitmentStart) + BigInt(votingParams.commitmentPeriod),
      );
      expect(actualVotingParams["1"].votingEndTime).to.equal(
        BigInt(votingParams.commitmentStart) +
          BigInt(votingParams.commitmentPeriod) +
          BigInt(votingParams.votingPeriod),
      );
      expect(await voting.smtTreeMaxDepth()).to.equal(treeHeight);
      expect(await voting.owner()).to.equal(OWNER.address);

      expect(await voting.voteVerifier()).to.equal(await votingVerifier.getAddress());
    });

    it("should revert if commitment start is in the past", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: commitment start must be in the future",
      );
    });

    it("should revert if commitment period is 0", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        commitmentPeriod: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: commitment period must be greater than 0",
      );
    });

    it("should revert if voting period is 0", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        votingPeriod: 0,
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith(
        "Voting: voting period must be greater than 0",
      );
    });

    it("should revert if candidates are not provided", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        candidates: [],
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith("Voting: candidates must be provided");
    });

    it("should revert if too many candidates are provided", async () => {
      const votingParams = {
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
        candidates: new Array(101).fill(ethers.ZeroHash),
      };

      await expect(voting.__Voting_init(votingParams)).to.be.revertedWith("Voting: too many candidates");
    });
  });

  describe("#registerForVoting -- lightweight tests", () => {
    let commitmentStartTimestamp: number;

    beforeEach("setup", async () => {
      commitmentStartTimestamp = (await time.latest()) + 60;

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: commitmentStartTimestamp,
      });
    });

    it("should revert if trying to register not during the commitment period", async () => {
      await expect(
        voting.registerForVoting(
          defaultProveIdentityParams,
          defaultRegisterVerifierParams,
          defaultTransitionStateParams,
          false,
        ),
      ).to.be.rejectedWith("Voting: the voting must be in the commitment state to register");
    });

    it("should revert if commitment was already used", async () => {
      await time.increase(commitmentStartTimestamp);

      await voting.registerForVotingMock(defaultRegisterVerifierParams);

      await expect(
        voting.registerForVoting(
          defaultProveIdentityParams,
          defaultRegisterVerifierParams,
          defaultTransitionStateParams,
          false,
        ),
      ).to.be.rejectedWith("Voting: commitment already exists");
    });
  });

  describe("#registerForVoting -- ZKP involved tests", () => {
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
      documentNullifier: poseidonHash("0x03"),
    };

    let valueAtSlot2: bigint;

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

    function buildValueAtSlot2(issuingAuthority: bigint, documentNullifier: bigint): bigint {
      return poseidon.hash([1n, issuingAuthority, documentNullifier]);
    }

    beforeEach("setup", async () => {
      user = await new Identity(UserPK, IDOwnershipLevels, IDOwnershipLevels, IDOwnershipLevels).postBuild();
      issuer = await new Identity(IssuerPK, IssuerLevels, IssuerLevels, IssuerLevels).postBuild();

      valueAtSlot2 = buildValueAtSlot2(
        BigInt(proofParamsStruct.issuingAuthority),
        BigInt(proofParamsStruct.documentNullifier),
      );

      [inputs, out] = await generateRegistrationData(user, issuer, valueAtSlot2, 0n);

      [points, publicSignals] = await getRegisterZKP(
        inputs,
        String(ethers.toBeHex(await voting.getAddress(), 32)),
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

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      });

      await time.increase((await time.latest()) + 60);
    });

    it("should register with state transition and ZKP proof", async () => {
      await expect(
        voting.registerForVoting(proveIdentityParams, proofParamsStruct, transitStateParams, false),
      ).to.be.rejectedWith("QueryValidator: gist root state isn't in state contract");

      await voting.registerForVoting(proveIdentityParams, proofParamsStruct, transitStateParams, true);
    });

    it("should register with already existing state transition and ZKP proof", async () => {
      await stateContract.signedTransitState(
        transitStateParams.newIdentitiesStatesRoot,
        transitStateParams.gistData,
        transitStateParams.proof,
      );

      await voting.registerForVoting(proveIdentityParams, proofParamsStruct, transitStateParams, false);
    });
  });

  describe("#vote", () => {
    let pair: SecretPair;
    let root: string;

    let zkpProof: { formattedProof: VerifierHelper.ProofPointsStruct; nullifierHash: string };

    beforeEach("register", async () => {
      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 20,
      });

      pair = generateSecrets();

      const commitment = getCommitment(pair);

      const registerVerifierParams = {
        ...deepClone(defaultRegisterVerifierParams),
        commitment: commitment,
      };

      await time.increaseTo((await voting.votingInfo())["1"].commitmentStartTime);

      await voting.registerForVotingMock(registerVerifierParams);

      root = await voting.getRoot();

      const commitmentIndex = poseidonHash(commitment);

      const onchainProof = await voting.getProof(commitmentIndex);

      zkpProof = await getVoteZKP(
        pair,
        root,
        ethers.toBeHex(OWNER.address, 32),
        await voting.getAddress(),
        onchainProof.siblings,
      );

      await time.increase((await time.latest()) + Number(defaultVotingParams.commitmentPeriod));
    });

    it("should revert if trying to vote not during the voting period", async () => {
      await time.increase(Number(defaultVotingParams.votingPeriod));

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: the voting must be in the pending state to vote");
    });

    it("should vote with correct ZKP proof", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);
    });

    it("should revert if trying to vote for non-candidate", async () => {
      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(FIRST.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: candidate doesn't exist");
    });

    it("should revert if vote with incorrect ZKP proof", async () => {
      zkpProof.formattedProof.a[0] = ethers.ZeroHash;

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: Invalid vote proof");
    });

    it("should revert if vote with non-existing root", async () => {
      await expect(
        voting.vote(
          ethers.ZeroHash,
          zkpProof.nullifierHash,
          ethers.toBeHex(OWNER.address, 32),
          zkpProof.formattedProof,
        ),
      ).to.be.revertedWith("Voting: root doesn't exist");
    });

    it("should revert if vote with used nullifier hash", async () => {
      await voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof);

      await expect(
        voting.vote(root, zkpProof.nullifierHash, ethers.toBeHex(OWNER.address, 32), zkpProof.formattedProof),
      ).to.be.revertedWith("Voting: nullifier already used");
    });
  });

  describe("#getProposalStatus", () => {
    it("should return correct proposal status", async () => {
      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NONE);

      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      });

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.NOT_STARTED);

      await time.increase(Number(defaultVotingParams.commitmentPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.COMMITMENT);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.PENDING);

      await time.increase(Number(defaultVotingParams.votingPeriod));

      expect(await voting.getProposalStatus()).to.equal(VotingStatus.ENDED);
    });
  });

  describe("#addRoot", () => {
    it("should record a root in history only by the owner", async () => {
      await voting.__Voting_init({
        ...deepClone(defaultVotingParams),
        commitmentStart: (await time.latest()) + 60,
      });

      await expect(voting.connect(FIRST).addRoot(ethers.ZeroHash)).to.be.rejectedWith(
        "Ownable: caller is not the owner",
      );

      await expect(voting.addRoot(ethers.ZeroHash)).to.be.eventually.fulfilled;
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

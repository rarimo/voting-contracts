import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter } from "@test-helpers";

import { IMPLEMENTATION_SLOT } from "@scripts";

import { IZKPQueriesStorage, PoseidonFacade, ZKPQueriesStorage } from "@ethers-v6";

const { poseidonContract } = require("circomlibjs");

export async function deployPoseidons(deployer: any, poseidonSizeParams: number[], isLog: boolean = true) {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(`Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`);
    }
  });

  const deployPoseidon = async (params: number, isLog: boolean) => {
    const abi = poseidonContract.generateABI(params);
    const code = poseidonContract.createCode(params);

    const PoseidonElements = new ethers.ContractFactory(abi, code, deployer);
    const poseidonElements = await PoseidonElements.deploy();

    if (isLog) {
      console.log(`Poseidon${params}Elements deployed to:`, await poseidonElements.getAddress());
    }

    return poseidonElements;
  };

  const result = [];

  for (const size of poseidonSizeParams) {
    result.push(await deployPoseidon(size, isLog));
  }

  return result;
}

export async function deployPoseidonFacade() {
  const poseidonContracts = await deployPoseidons(
    (await ethers.getSigners())[0],
    new Array(6).fill(6).map((_, i) => i + 1),
    false,
  );

  const SpongePoseidonFactory = await ethers.getContractFactory("SpongePoseidon", {
    libraries: {
      PoseidonUnit6L: await poseidonContracts[5].getAddress(),
    },
  });

  const spongePoseidon = await SpongePoseidonFactory.deploy();

  const PoseidonFacadeFactory = await ethers.getContractFactory("PoseidonFacade", {
    libraries: {
      PoseidonUnit1L: await poseidonContracts[0].getAddress(),
      PoseidonUnit2L: await poseidonContracts[1].getAddress(),
      PoseidonUnit3L: await poseidonContracts[2].getAddress(),
      PoseidonUnit4L: await poseidonContracts[3].getAddress(),
      PoseidonUnit5L: await poseidonContracts[4].getAddress(),
      PoseidonUnit6L: await poseidonContracts[5].getAddress(),
      SpongePoseidon: await spongePoseidon.getAddress(),
    },
  });

  const poseidonFacade = await PoseidonFacadeFactory.deploy();

  return {
    poseidonContracts,
    spongePoseidon,
    poseidonFacade,
  };
}

describe("ZKPQueriesStorage", () => {
  const reverter = new Reverter();

  const circuitQuery = {
    schema: 78927927240581107041951874774584917853n,
    claimPathKey: 16153502378554866159038850585713705546745830858436223350513476757548188765156n,
    operator: 1,
    value: [1n, ...new Array(63).fill(0).map(() => 0n)],
    queryHash: 0n,
    circuitId: "credentialAtomicQuerySigV2OnChain",
  };

  const REGISTER_PROOF_QUERY_ID = "REGISTER_PROOF";

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let VALIDATOR: SignerWithAddress;
  let LIGHTWEIGHT_STATE: SignerWithAddress;

  let zkpQueriesStorage: ZKPQueriesStorage;
  let poseidonFacade: PoseidonFacade;

  function checkCircuitQuery(actualQuery: any, expectedQuery: any) {
    expect(actualQuery.schema).to.be.eq(expectedQuery.schema);
    expect(actualQuery.circuitId).to.be.eq(expectedQuery.circuitId);
    expect(actualQuery.claimPathKey).to.be.eq(expectedQuery.claimPathKey);
    expect(actualQuery.operator).to.be.eq(expectedQuery.operator);
    expect(actualQuery.queryHash).to.be.eq(expectedQuery.queryHash);
    expect(actualQuery.value).to.be.deep.eq(expectedQuery.value);
  }

  before(async () => {
    [OWNER, FIRST, VALIDATOR, LIGHTWEIGHT_STATE] = await ethers.getSigners();

    poseidonFacade = (await deployPoseidonFacade()).poseidonFacade;

    const ZKPQueriesStorageFactory = await ethers.getContractFactory("ZKPQueriesStorage", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    zkpQueriesStorage = await ZKPQueriesStorageFactory.deploy();

    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await Proxy.deploy(await zkpQueriesStorage.getAddress(), "0x");

    zkpQueriesStorage = zkpQueriesStorage.attach(await proxy.getAddress()) as ZKPQueriesStorage;

    await zkpQueriesStorage.__ZKPQueriesStorage_init(LIGHTWEIGHT_STATE.address);

    circuitQuery.queryHash = await poseidonFacade.poseidon6([
      circuitQuery.schema,
      0,
      circuitQuery.operator,
      circuitQuery.claimPathKey,
      0,
      await poseidonFacade.poseidonSponge(circuitQuery.value),
    ]);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct init values", async () => {
      expect(await zkpQueriesStorage.owner()).to.be.eq(OWNER.address);
      expect(await zkpQueriesStorage.lightweightState()).to.be.eq(LIGHTWEIGHT_STATE.address);
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: the contract is already initialized";

      expect(zkpQueriesStorage.__ZKPQueriesStorage_init(LIGHTWEIGHT_STATE.address)).to.be.revertedWith(reason);
    });

    it("should get exception if pass zero lightweight state contract address", async () => {
      const ZKPQueriesStorageFactory = await ethers.getContractFactory("ZKPQueriesStorage", {
        libraries: {
          PoseidonFacade: await poseidonFacade.getAddress(),
        },
      });

      const newZKPQueriesStorage = await ZKPQueriesStorageFactory.deploy();

      const reason = "ZKPQueriesStorage: Zero lightweightState address.";

      expect(newZKPQueriesStorage.__ZKPQueriesStorage_init(ethers.ZeroAddress)).to.be.revertedWith(reason);
    });
  });

  describe("setZKPQuery", () => {
    it("should correctly set ZKP Query", async () => {
      const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
        queryValidator: VALIDATOR.address,
        circuitQuery,
      };

      const tx = await zkpQueriesStorage.setZKPQuery(REGISTER_PROOF_QUERY_ID, queryInfo);

      expect(await zkpQueriesStorage.getSupportedQueryIDs()).to.be.deep.eq([REGISTER_PROOF_QUERY_ID]);

      const storedQueryInfo = await zkpQueriesStorage.getQueryInfo(REGISTER_PROOF_QUERY_ID);

      expect(storedQueryInfo.queryValidator).to.be.eq(VALIDATOR.address);
      checkCircuitQuery(storedQueryInfo.circuitQuery, circuitQuery);

      expect(tx)
        .to.emit(zkpQueriesStorage, "ZKPQuerySet")
        .withArgs(REGISTER_PROOF_QUERY_ID, queryInfo.queryValidator, queryInfo.circuitQuery);
    });

    it("should get exception if pass zero validator address", async () => {
      const reason = "ZKPQueriesStorage: Zero queryValidator address.";

      const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
        queryValidator: ethers.ZeroAddress,
        circuitQuery,
      };

      expect(zkpQueriesStorage.setZKPQuery(REGISTER_PROOF_QUERY_ID, queryInfo)).to.be.revertedWith(reason);
    });

    it("should get exception if nonowner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
        queryValidator: ethers.ZeroAddress,
        circuitQuery,
      };

      expect(zkpQueriesStorage.connect(FIRST).setZKPQuery(REGISTER_PROOF_QUERY_ID, queryInfo)).to.be.revertedWith(
        reason,
      );
    });
  });

  describe("removeZKPQuery", () => {
    beforeEach("setup", async () => {
      const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
        queryValidator: VALIDATOR.address,
        circuitQuery,
      };

      await zkpQueriesStorage.setZKPQuery(REGISTER_PROOF_QUERY_ID, queryInfo);
    });

    it("should correctly remove ZKP Query", async () => {
      expect(await zkpQueriesStorage.isQueryExists(REGISTER_PROOF_QUERY_ID)).to.be.eq(true);

      const tx = await zkpQueriesStorage.removeZKPQuery(REGISTER_PROOF_QUERY_ID);

      expect(await zkpQueriesStorage.isQueryExists(REGISTER_PROOF_QUERY_ID)).to.be.eq(false);

      const storedQueryInfo = await zkpQueriesStorage.getQueryInfo(REGISTER_PROOF_QUERY_ID);

      expect(storedQueryInfo.queryValidator).to.be.eq(ethers.ZeroAddress);
      expect(storedQueryInfo.circuitQuery.schema).to.be.eq(0);
      expect(storedQueryInfo.circuitQuery.circuitId).to.be.eq("");
      expect(storedQueryInfo.circuitQuery.claimPathKey).to.be.eq(0);
      expect(storedQueryInfo.circuitQuery.operator).to.be.eq(0);
      expect(storedQueryInfo.circuitQuery.queryHash).to.be.eq(0);
      expect(storedQueryInfo.circuitQuery.value).to.be.deep.eq([]);

      expect(tx).to.emit(zkpQueriesStorage, "ZKPQueryRemoved").withArgs(REGISTER_PROOF_QUERY_ID);
    });

    it("should get exception if try to remove nonexisting ZKP Query", async () => {
      const reason = "ZKPQueriesStorage: ZKP Query does not exist.";
      const queryID = "SOME_ID";

      expect(zkpQueriesStorage.removeZKPQuery(queryID)).to.be.revertedWith(reason);
    });

    it("should get exception if nonowner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      expect(zkpQueriesStorage.connect(FIRST).removeZKPQuery(REGISTER_PROOF_QUERY_ID)).to.be.revertedWith(reason);
    });
  });

  describe("getters", () => {
    beforeEach("setup", async () => {
      const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
        queryValidator: VALIDATOR.address,
        circuitQuery,
      };

      await zkpQueriesStorage.setZKPQuery(REGISTER_PROOF_QUERY_ID, queryInfo);
    });

    it("should return correct data", async () => {
      expect(await zkpQueriesStorage.getQueryValidator(REGISTER_PROOF_QUERY_ID)).to.be.eq(VALIDATOR.address);
      checkCircuitQuery(await zkpQueriesStorage.getStoredCircuitQuery(REGISTER_PROOF_QUERY_ID), circuitQuery);

      expect(await zkpQueriesStorage.getStoredQueryHash(REGISTER_PROOF_QUERY_ID)).to.be.eq(circuitQuery.queryHash);
      expect(await zkpQueriesStorage.getStoredSchema(REGISTER_PROOF_QUERY_ID)).to.be.eq(circuitQuery.schema);

      expect(await zkpQueriesStorage.getQueryHash(circuitQuery)).to.be.eq(circuitQuery.queryHash);
      expect(
        await zkpQueriesStorage.getQueryHashRaw(
          circuitQuery.schema,
          circuitQuery.operator,
          circuitQuery.claimPathKey,
          circuitQuery.value,
        ),
      ).to.be.eq(circuitQuery.queryHash);
    });
  });

  describe("authorizeUpgrade", () => {
    it("should revert if trying to upgrade by not owner", async () => {
      await expect(zkpQueriesStorage.connect(FIRST).upgradeTo(ethers.Wallet.createRandom().address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should upgrade", async () => {
      const ZKPQueriesStorageFactory = await ethers.getContractFactory("ZKPQueriesStorage", {
        libraries: {
          PoseidonFacade: await poseidonFacade.getAddress(),
        },
      });
      const newImplementation = await ZKPQueriesStorageFactory.deploy();

      await zkpQueriesStorage.upgradeTo(await newImplementation.getAddress());

      expect(await ethers.provider.getStorage(await zkpQueriesStorage.getAddress(), IMPLEMENTATION_SLOT)).to.be.equal(
        ethers.toBeHex(await newImplementation.getAddress(), 32).toLowerCase(),
      );
    });
  });
});

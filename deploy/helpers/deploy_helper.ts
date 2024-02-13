import { Deployer } from "@solarity/hardhat-migrate";

import { Config, isZeroAddr } from "./config_parser";

const { poseidonContract } = require("circomlibjs");

import {
  ERC1967Proxy__factory,
  VerifierMTP__factory,
  QueryMTPValidator__factory,
  LightweightState__factory,
  ZKPQueriesStorage__factory,
  RegisterVerifier__factory,
  StateLib__factory,
  SmtLib__factory,
  State__factory,
  VerifierV2__factory,
} from "@ethers-v6";

export async function deployPoseidons(deployer: Deployer, poseidonSizeParams: number[]) {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(`Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`);
    }
  });

  const deployPoseidon = async (size: number) => {
    const abi = poseidonContract.generateABI(size);
    const bytecode = poseidonContract.createCode(size);

    await deployer.deploy({
      abi,
      bytecode,
      contractName: `@iden3/contracts/lib/Poseidon.sol:PoseidonUnit${size}L`,
    });
  };

  for (const size of poseidonSizeParams) {
    await deployPoseidon(size);
  }
}

export async function deployQueryValidator(deployer: Deployer, config: Config) {
  if (isZeroAddr(config.validatorContractInfo.validatorAddr)) {
    const stateAddr = await (await getDeployedStateContract(deployer, config)).getAddress();
    const identitiesStatesUpdateTime = config.validatorContractInfo.identitiesStatesUpdateTime;

    if (!identitiesStatesUpdateTime) {
      throw new Error("Invalid identities states update time");
    }

    await deployMTPValidator(deployer, stateAddr, identitiesStatesUpdateTime);
  } else {
    await deployer.save(QueryMTPValidator__factory, config.validatorContractInfo.validatorAddr!);
  }
}

export async function deployState(deployer: Deployer, config: Config) {
  if (Boolean(config.stateContractInfo.isLightweight)) {
    await deployLightweightState(deployer, config);
  } else {
    await deployStateContract(deployer, config);
  }
}

export async function deployVerifier(deployer: Deployer, config: Config) {
  await deployRegisterVerifier(deployer, config);
}

export async function getDeployedQueryValidatorContract(deployer: Deployer) {
  return await deployer.deployed(QueryMTPValidator__factory, "QueryMTPValidator Proxy");
}

export async function getDeployedStateContract(deployer: Deployer, config: Config) {
  if (Boolean(config.stateContractInfo.isLightweight)) {
    return await deployer.deployed(LightweightState__factory, "LightweightState Proxy");
  } else {
    return await deployer.deployed(State__factory, "State Proxy");
  }
}

export async function getDeployedVerifierContract(deployer: Deployer) {
  return await deployer.deployed(RegisterVerifier__factory, "RegisterVerifier Proxy");
}

async function deployMTPValidator(
  deployer: Deployer,
  stateContractAddr: string,
  identitiesStatesUpdateTime: string | number,
) {
  const queryMTPVerifier = await deployer.deploy(VerifierMTP__factory);
  const queryMTPValidatorImpl = await deployer.deploy(QueryMTPValidator__factory);
  const queryMTPValidatorProxy = await deployer.deploy(
    ERC1967Proxy__factory,
    [await queryMTPValidatorImpl.getAddress(), "0x"],
    { name: "QueryMTPValidator Proxy" },
  );

  const queryMTPValidator = await deployer.deployed(
    QueryMTPValidator__factory,
    await queryMTPValidatorProxy.getAddress(),
  );

  await queryMTPValidator.__QueryMTPValidator_init(
    await queryMTPVerifier.getAddress(),
    stateContractAddr,
    identitiesStatesUpdateTime,
  );

  return await queryMTPValidator.getAddress();
}

async function deployStateContract(deployer: Deployer, config: Config) {
  if (isZeroAddr(config.stateContractInfo.stateAddr)) {
    const stateVerifier = await deployer.deploy(VerifierV2__factory);

    await deployer.deploy(SmtLib__factory);
    await deployer.deploy(StateLib__factory);

    const stateImpl = await deployer.deploy(State__factory);

    const stateProxy = await deployer.deploy(ERC1967Proxy__factory, [await stateImpl.getAddress(), "0x"], {
      name: "State Proxy",
    });

    const stateContract = await deployer.deployed(State__factory, await stateProxy.getAddress());

    await stateContract.__State_init((await stateVerifier.getAddress()) as any);
  } else {
    await deployer.save(State__factory, config.stateContractInfo.stateAddr!);
  }
}

async function deployLightweightState(deployer: Deployer, config: Config) {
  if (isZeroAddr(config.stateContractInfo.stateAddr)) {
    const lightweightStateImpl = await deployer.deploy(LightweightState__factory);
    const lightweightStateProxy = await deployer.deploy(
      ERC1967Proxy__factory,
      [await lightweightStateImpl.getAddress(), "0x"],
      { name: "LightweightState Proxy" },
    );

    const lightweightState = await deployer.deployed(
      LightweightState__factory,
      await lightweightStateProxy.getAddress(),
    );

    if (config.stateContractInfo.stateInitParams) {
      await lightweightState.__LightweightState_init(
        config.stateContractInfo.stateInitParams.signer,
        config.stateContractInfo.stateInitParams.sourceStateContract,
        config.stateContractInfo.stateInitParams.sourceChainName,
        config.stateContractInfo.stateInitParams.chainName,
      );
    } else {
      throw new Error("Invalid state init params");
    }
  } else {
    await deployer.save(LightweightState__factory, config.stateContractInfo.stateAddr!);
  }
}

async function deployRegisterVerifier(deployer: Deployer, config: Config) {
  if (isZeroAddr(config.registerVerifierInfo.registerVerifierAddr)) {
    const registerVerifierImpl = await deployer.deploy(RegisterVerifier__factory);
    const identityVerifierProxy = await deployer.deploy(
      ERC1967Proxy__factory,
      [await registerVerifierImpl.getAddress(), "0x"],
      { name: "RegisterVerifier Proxy" },
    );

    const registerVerifier = await deployer.deployed(
      RegisterVerifier__factory,
      await identityVerifierProxy.getAddress(),
    );

    const zkpQueriesStorage = await deployer.deployed(ZKPQueriesStorage__factory, "ZKPQueriesStorage Proxy");

    await registerVerifier.__RegisterVerifier_init((await zkpQueriesStorage.getAddress()) as any);
  } else {
    await deployer.save(RegisterVerifier__factory, config.registerVerifierInfo.registerVerifierAddr!);
  }
}

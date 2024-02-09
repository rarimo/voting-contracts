import { Deployer } from "@solarity/hardhat-migrate";

import { Config, isZeroAddr } from "./config_parser";

const { poseidonContract } = require("circomlibjs");

import {
  ERC1967Proxy__factory,
  VerifierMTP__factory,
  QueryMTPValidator__factory,
  LightweightState__factory,
  ZKPQueriesStorage__factory,
  IdentityVerifier__factory,
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
      contractName: `contracts/libs/Poseidon.sol:PoseidonUnit${size}L`,
    });
  };

  for (const size of poseidonSizeParams) {
    await deployPoseidon(size);
  }
}

export async function deployQueryValidator(deployer: Deployer, config: Config) {
  let validatorAddr: string;

  if (isZeroAddr(config.validatorContractInfo.validatorAddr)) {
    const stateAddr = await (await getDeployedStateContract(deployer)).getAddress();
    const identitiesStatesUpdateTime = config.validatorContractInfo.identitiesStatesUpdateTime;

    if (!identitiesStatesUpdateTime) {
      throw new Error("Invalid identities states update time");
    }

    validatorAddr = await deployMTPValidator(deployer, stateAddr, identitiesStatesUpdateTime);
  } else {
    validatorAddr = config.validatorContractInfo.validatorAddr!;
  }

  await deployer.save(QueryMTPValidator__factory, validatorAddr);
}

export async function deployState(deployer: Deployer, config: Config) {
  await deployLightweightState(deployer, config);
}

export async function deployVerifier(deployer: Deployer, config: Config) {
  await deployIdentityVerifier(deployer, config);
}

export async function getDeployedQueryValidatorContract(deployer: Deployer) {
  return await deployer.deployed(QueryMTPValidator__factory);
}

export async function getDeployedStateContract(deployer: Deployer) {
  return await deployer.deployed(LightweightState__factory);
}

export async function getDeployedVerifierContract(deployer: Deployer) {
  return await deployer.deployed(IdentityVerifier__factory);
}

async function deployMTPValidator(
  deployer: Deployer,
  stateContractAddr: string,
  identitiesStatesUpdateTime: string | number,
) {
  const queryMTPVerifier = await deployer.deploy(VerifierMTP__factory);
  const queryMTPValidatorImpl = await deployer.deploy(QueryMTPValidator__factory);
  const queryMTPValidatorProxy = await deployer.deploy(ERC1967Proxy__factory, [
    await queryMTPValidatorImpl.getAddress(),
    "0x",
  ]);

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

async function deployLightweightState(deployer: Deployer, config: Config) {
  let lightweightState;

  if (isZeroAddr(config.stateContractInfo.stateAddr)) {
    const lightweightStateImpl = await deployer.deploy(LightweightState__factory);
    const lightweightStateProxy = await deployer.deploy(ERC1967Proxy__factory, [
      await lightweightStateImpl.getAddress(),
      "0x",
    ]);

    lightweightState = await deployer.deployed(LightweightState__factory, await lightweightStateProxy.getAddress());

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
    lightweightState = await deployer.deployed(LightweightState__factory, config.stateContractInfo.stateAddr);
  }

  await deployer.save(LightweightState__factory, await lightweightState.getAddress());
}

async function deployIdentityVerifier(deployer: Deployer, config: Config) {
  let identityVerifier;

  if (isZeroAddr(config.identityVerifierInfo.identityVerifierAddr)) {
    const identityVerifierImpl = await deployer.deploy(IdentityVerifier__factory);
    const identityVerifierProxy = await deployer.deploy(ERC1967Proxy__factory, [
      await identityVerifierImpl.getAddress(),
      "0x",
    ]);

    identityVerifier = await deployer.deployed(IdentityVerifier__factory, await identityVerifierProxy.getAddress());

    const zkpQueriesStorage = await deployer.deploy(ZKPQueriesStorage__factory);

    await identityVerifier.__IdentityVerifier_init(await zkpQueriesStorage.getAddress());
  } else {
    identityVerifier = await deployer.deployed(
      IdentityVerifier__factory,
      config.identityVerifierInfo.identityVerifierAddr,
    );
  }

  await deployer.save(IdentityVerifier__factory, await identityVerifier.getAddress());
}

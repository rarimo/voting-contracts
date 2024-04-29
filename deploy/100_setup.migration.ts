import { Deployer } from "@solarity/hardhat-migrate";

import { VotingRegistry__factory, ZKPQueriesStorage__factory } from "@ethers-v6";

import { Config, getDeployedQueryValidatorContract, getDeployedVerifierContract, parseConfig } from "@deploy-helper";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig(process.env.CONFIG_PATH!);

  const baseVerifier = await getDeployedVerifierContract(deployer);
  const queryValidator = await getDeployedQueryValidatorContract(deployer);
  const votingRegistry = await deployer.deployed(VotingRegistry__factory, "VotingRegistry Proxy");
  const zkpQueriesStorage = await deployer.deployed(ZKPQueriesStorage__factory, "ZKPQueriesStorage Proxy");

  await baseVerifier.transferOwnership(config.owners.baseVerifier);
  await queryValidator.transferOwnership(config.owners.queryValidator);
  await votingRegistry.transferOwnership(config.owners.votingRegistry);
  await zkpQueriesStorage.transferOwnership(config.owners.zkpQueriesStorage);
};

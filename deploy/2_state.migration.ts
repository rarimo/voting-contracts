import { Deployer } from "@solarity/hardhat-migrate";

import { Config, deployState, parseConfig } from "@deploy-helper";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  await deployState(deployer, config);
};

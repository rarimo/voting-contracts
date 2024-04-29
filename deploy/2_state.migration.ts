import { Deployer } from "@solarity/hardhat-migrate";

import { Config, deployState, parseConfig } from "@deploy-helper";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig(process.env.CONFIG_PATH!);

  await deployState(deployer, config);
};

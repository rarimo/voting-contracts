import { Deployer } from "@solarity/hardhat-migrate";

import { Config, deployQueryValidator, parseConfig } from "@deploy-helper";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig(process.env.CONFIG_PATH!);

  await deployQueryValidator(deployer, config);
};

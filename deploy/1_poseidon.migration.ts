import { Deployer } from "@solarity/hardhat-migrate";

import { Config, deployPoseidons, isZeroAddr, parseConfig } from "@deploy-helper";

import { PoseidonFacade__factory, SpongePoseidon__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig(process.env.CONFIG_PATH!);

  if (isZeroAddr(config.poseidonFacade)) {
    await deployPoseidons(
      deployer,
      new Array(6).fill(6).map((_, i) => i + 1),
    );

    await deployer.deploy(SpongePoseidon__factory);
    await deployer.deploy(PoseidonFacade__factory);
  } else {
    await deployer.save("@iden3/contracts/lib/Poseidon.sol:PoseidonFacade", config.poseidonFacade!);
  }
};

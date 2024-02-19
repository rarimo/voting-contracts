import { Deployer } from "@solarity/hardhat-migrate";

import { Config, getDeployedQueryValidatorContract, isZeroAddr, parseConfig, ZKPQueryInfo } from "@deploy-helper";

import { IZKPQueriesStorage, ZKPQueriesStorage__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  const zkpQueriesStorage = await deployer.deployed(ZKPQueriesStorage__factory, "ZKPQueriesStorage Proxy");

  let validator = await getDeployedQueryValidatorContract(deployer);

  for (let i = 0; i < config.zkpQueries.length; i++) {
    const zkpQueryInfo: ZKPQueryInfo = config.zkpQueries[i];
    let currentValidatorAddr;

    if (isZeroAddr(zkpQueryInfo.validatorAddr)) {
      currentValidatorAddr = await validator.getAddress();
    } else {
      currentValidatorAddr = zkpQueryInfo.validatorAddr!;
    }

    const queryInfo: IZKPQueriesStorage.QueryInfoStruct = {
      circuitQuery: zkpQueryInfo.query,
      circuitId: zkpQueryInfo.circuitId,
      queryValidator: currentValidatorAddr,
    };

    await zkpQueriesStorage.setZKPQuery(zkpQueryInfo.queryId as string, queryInfo, {
      customData: { txName: " `ZKP Query with ${zkpQueryInfo.queryId} id is set`" },
    });
  }
};

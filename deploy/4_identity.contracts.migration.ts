import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import {
  Config,
  deployVerifier,
  getDeployedQueryValidatorContract,
  getDeployedStateContract,
  getDeployedVerifierContract,
  isZeroAddr,
  parseConfig,
} from "@deploy-helper";

import { ERC1967Proxy__factory, ZKPQueriesStorage__factory, PoseidonFacade__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig(process.env.CONFIG_PATH!);

  const poseidonFacade = await deployer.deployed(PoseidonFacade__factory);

  const stateContractInfo = ["LightweightState", await (await getDeployedStateContract(deployer)).getAddress()];

  let zkpQueriesStorage;

  if (isZeroAddr(config.zkpQueriesStorage)) {
    const zkpQueriesStorageImpl = await deployer.deploy(ZKPQueriesStorage__factory);
    const zkpQueriesStorageProxy = await deployer.deploy(
      ERC1967Proxy__factory,
      [await zkpQueriesStorageImpl.getAddress(), "0x"],
      { name: "ZKPQueriesStorage Proxy" },
    );

    zkpQueriesStorage = await deployer.deployed(ZKPQueriesStorage__factory, await zkpQueriesStorageProxy.getAddress());

    await zkpQueriesStorage.__ZKPQueriesStorage_init(stateContractInfo[1] as any);
  } else {
    zkpQueriesStorage = await deployer.deployed(ZKPQueriesStorage__factory, config.zkpQueriesStorage);
  }

  await deployVerifier(deployer, config);

  const validatorsInfo = ["QueryMTPValidator", await (await getDeployedQueryValidatorContract(deployer)).getAddress()];
  const verifierInfo = ["IdentityVerifier", await (await getDeployedVerifierContract(deployer)).getAddress()];

  Reporter.reportContracts(
    stateContractInfo as [string, string],
    validatorsInfo as [string, string],
    verifierInfo as [string, string],
    ["ZKPQueriesStorage", await zkpQueriesStorage.getAddress()],
    ["PoseidonFacade", await poseidonFacade.getAddress()],
  );
};

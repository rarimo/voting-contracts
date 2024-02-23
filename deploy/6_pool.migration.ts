import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import {
  ERC1967Proxy__factory,
  VoteVerifier__factory,
  Voting__factory,
  Registration__factory,
  PoolFactory__factory,
  PoolRegistry__factory,
} from "@ethers-v6";

import { getDeployedVerifierContract } from "@deploy-helper";

export = async (deployer: Deployer) => {
  let votingRegistry = await deployer.deploy(PoolRegistry__factory);
  let votingFactory = await deployer.deploy(PoolFactory__factory);

  const votingRegistryProxy = await deployer.deploy(ERC1967Proxy__factory, [await votingRegistry.getAddress(), "0x"], {
    name: "PoolRegistry Proxy",
  });
  const votingFactoryProxy = await deployer.deploy(ERC1967Proxy__factory, [await votingFactory.getAddress(), "0x"], {
    name: "PoolFactory Proxy",
  });

  votingRegistry = await deployer.deployed(PoolRegistry__factory, await votingRegistryProxy.getAddress());
  votingFactory = await deployer.deployed(PoolFactory__factory, await votingFactoryProxy.getAddress());

  await votingRegistry.__PoolRegistry_init(await votingFactory.getAddress());
  await votingFactory.__PoolFactory_init(await votingRegistry.getAddress());

  const voteVerifier = await deployer.deploy(VoteVerifier__factory);
  const registerVerifier = await getDeployedVerifierContract(deployer);

  const registration = await deployer.deploy(Registration__factory, [await registerVerifier.getAddress(), 80]);
  const voting = await deployer.deploy(Voting__factory, [await voteVerifier.getAddress()]);

  await votingRegistry.setNewImplementations(["Simple Pool"], [await voting.getAddress()]);
  await votingRegistry.setNewImplementations(["Simple Registration"], [await registration.getAddress()]);

  Reporter.reportContracts(
    ["PoolRegistry", await votingRegistry.getAddress()],
    ["PoolFactory", await votingFactory.getAddress()],
    ["Simple Pool", await voting.getAddress()],
    ["Simple Registration", await registration.getAddress()],
    ["VoteVerifier", await voteVerifier.getAddress()],
  );
};

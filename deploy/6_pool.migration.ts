import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import {
  ERC1967Proxy__factory,
  VoteVerifier__factory,
  Voting__factory,
  Registration__factory,
  VotingFactory__factory,
  VotingRegistry__factory,
} from "@ethers-v6";

import { getDeployedVerifierContract } from "@deploy-helper";

export = async (deployer: Deployer) => {
  let votingRegistry = await deployer.deploy(VotingRegistry__factory);
  let votingFactory = await deployer.deploy(VotingFactory__factory);

  const votingRegistryProxy = await deployer.deploy(ERC1967Proxy__factory, [await votingRegistry.getAddress(), "0x"], {
    name: "VotingRegistry Proxy",
  });
  const votingFactoryProxy = await deployer.deploy(ERC1967Proxy__factory, [await votingFactory.getAddress(), "0x"], {
    name: "VotingFactory Proxy",
  });

  votingRegistry = await deployer.deployed(VotingRegistry__factory, await votingRegistryProxy.getAddress());
  votingFactory = await deployer.deployed(VotingFactory__factory, await votingFactoryProxy.getAddress());

  await votingRegistry.__VotingRegistry_init(await votingFactory.getAddress());
  await votingFactory.__VotingFactory_init(await votingRegistry.getAddress());

  const voteVerifier = await deployer.deploy(VoteVerifier__factory);
  const registerVerifier = await getDeployedVerifierContract(deployer);

  const registration = await deployer.deploy(Registration__factory, [await registerVerifier.getAddress(), 80]);
  const voting = await deployer.deploy(Voting__factory, [await voteVerifier.getAddress()]);

  await votingRegistry.setNewImplementations(
    ["Simple Voting", "Simple Registration"],
    [await voting.getAddress(), await registration.getAddress()],
  );

  Reporter.reportContracts(
    ["VotingRegistry", await votingRegistry.getAddress()],
    ["VotingFactory", await votingFactory.getAddress()],
    ["Simple Voting", await voting.getAddress()],
    ["Simple Registration", await registration.getAddress()],
    ["VoteVerifier", await voteVerifier.getAddress()],
  );
};

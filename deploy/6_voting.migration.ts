import { ethers } from "hardhat";

import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import {
  ERC1967Proxy__factory,
  VoteVerifier__factory,
  Voting__factory,
  VotingFactory__factory,
  VotingRegistry__factory,
} from "@ethers-v6";

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

  const voting = await deployer.deploy(Voting__factory, [await voteVerifier.getAddress(), ethers.ZeroAddress, 80]);

  await votingRegistry.setNewImplementations(["Simple Voting"], [await voting.getAddress()]);

  Reporter.reportContracts(
    ["VotingRegistry", await votingRegistry.getAddress()],
    ["VotingFactory", await votingFactory.getAddress()],
    ["Simple Voting", await voting.getAddress()],
    ["VoteVerifier", await voteVerifier.getAddress()],
  );
};

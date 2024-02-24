import { ethers } from "ethers";

import { Deployer } from "@solarity/hardhat-migrate";

import {
  VotingFactory__factory,
  VotingRegistry__factory,
  RegistrationMock__factory,
  Voting__factory,
} from "@ethers-v6";
import { IVoting } from "@/generated-types/contracts/Voting";

export = async (deployer: Deployer) => {
  const votingRegistry = await deployer.deployed(VotingRegistry__factory, "VotingRegistry Proxy");
  const votingFactory = await deployer.deployed(VotingFactory__factory, "VotingFactory Proxy");

  await votingFactory.createRegistration("Mock Registration", "0x");

  const registrationAddress = (await votingRegistry.listPoolsByType("Mock Registration", 0, 1))[0];

  let defaultVotingParams: IVoting.VotingParamsStruct = {
    remark: "Voting remark",
    registration: registrationAddress,
    votingStart: Math.trunc(new Date().getTime() / 1_000) + 60,
    votingPeriod: 3600 * 300,
    candidates: [ethers.ZeroHash],
  };

  await votingFactory.createVoting(
    "Simple Voting",
    Voting__factory.createInterface().encodeFunctionData("__Voting_init", [defaultVotingParams]),
  );

  console.log(await votingRegistry.listPoolsByType("Simple Voting", 0, 10));
};

import { Deployer } from "@solarity/hardhat-migrate";

import { IRegistration, VotingFactory__factory, VotingRegistry__factory, Registration__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const votingRegistry = await deployer.deployed(VotingRegistry__factory, "VotingRegistry Proxy");
  const votingFactory = await deployer.deployed(VotingFactory__factory, "VotingFactory Proxy");

  let defaultVotingParams: IRegistration.RegistrationParamsStruct = {
    remark: "Voting remark",
    commitmentStart: Math.trunc(new Date().getTime() / 1_000) + 60,
    commitmentPeriod: 3600 * 120,
  };

  await votingFactory.createRegistration(
    "Simple Registration",
    Registration__factory.createInterface().encodeFunctionData("__Registration_init", [defaultVotingParams]),
  );

  console.log(await votingRegistry.listPoolsByType("Simple Registration", 0, 10));
};

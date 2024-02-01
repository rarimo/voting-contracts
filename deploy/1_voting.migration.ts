import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { PoseidonVerifier__factory, VoteVerifier__factory, Voting__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const voteVerifier = await deployer.deploy(VoteVerifier__factory);
  const registrationVerifier = await deployer.deploy(PoseidonVerifier__factory);

  const voting = await deployer.deploy(Voting__factory, [
    await voteVerifier.getAddress(),
    await registrationVerifier.getAddress(),
    20,
  ]);

  Reporter.reportContracts(
    ["Voting", await voting.getAddress()],
    ["VoteVerifier", await voteVerifier.getAddress()],
    ["PoseidonVerifier", await registrationVerifier.getAddress()],
  );
};

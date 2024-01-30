import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { Groth16Verifier__factory, Voting__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const verifier = await deployer.deploy(Groth16Verifier__factory);

  const voting = await deployer.deploy(Voting__factory, [await verifier.getAddress(), 20]);

  Reporter.reportContracts(["Verifier", await verifier.getAddress()], ["Voting", await voting.getAddress()]);
};

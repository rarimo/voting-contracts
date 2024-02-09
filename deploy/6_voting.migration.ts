import { Deployer, Reporter } from "@solarity/hardhat-migrate";

// @ts-ignore
import { poseidonContract } from "circomlibjs";

import { PoseidonVerifier__factory, VoteVerifier__factory, Voting__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  const voteVerifier = await deployer.deploy(VoteVerifier__factory);
  const registrationVerifier = await deployer.deploy(PoseidonVerifier__factory);

  await deployer.deploy({
    abi: poseidonContract.generateABI(1),
    bytecode: poseidonContract.createCode(1),
    contractName: "contracts/libs/Poseidon.sol:PoseidonUnit1L",
  });

  await deployer.deploy({
    abi: poseidonContract.generateABI(2),
    bytecode: poseidonContract.createCode(2),
    contractName: "contracts/libs/Poseidon.sol:PoseidonUnit2L",
  });

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

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import * as zk from "zksync-ethers";

const deployScript = async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new zk.Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  let contract = await deployer.deploy("TestContract");
  contract = await contract.waitForDeployment();

  console.log(contract);

  // let paddedBytecode = bytecode;
  // if (bytecode.length / 2 % 32 !== 0) {
  //   const reminder = bytecode.length / 2 % 32;
  //   const additionalBytes = 32 - reminder;
  //
  //   paddedBytecode = ethers.zeroPadBytes(bytecode, bytecode.length / 2 + additionalBytes)
  // }
  //
  // const factory = new zk.ContractFactory<any[], zk.Contract>(
  //   abi,
  //   paddedBytecode,
  //   wallet,
  //   'create',
  // );
  //
  // contract = await factory.deploy();
  // await contract.waitForDeployment();
};

export default deployScript;

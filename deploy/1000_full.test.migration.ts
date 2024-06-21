import { Deployer } from "@solarity/hardhat-migrate";

import { ethers } from "ethers";

import { IRegistration, IVoting, Registration__factory, Voting__factory, VotingFactory__factory } from "@ethers-v6";

import {
  VotingMetadata,
  RegistrationMetadata,
  uploadJSONToIPFS,
  registrationMetadataTemplate,
  votingMetadataTemplate,
} from "@/deploy/ipfs/scripts";

const DURATION = 60 * 60 * 24 * 32;
const REG_START_TIMESTAMP = Math.trunc(new Date().getTime() / 1_000) + 200;

const DEPLOYMENT_SALT = 0n;

const BASE_IPFS_URI = "https://ipfs.io/ipfs/";

const FACTORY_ADDRESS = "<Factory Address>";

const REGISTRATION_TYPE = "Simple Registration";
const VOTING_TYPE = "Simple Voting";

export = async (deployer: Deployer) => {
  const votingFactory = await deployer.deployed(VotingFactory__factory, FACTORY_ADDRESS);

  const signer = await deployer.getSigner();

  let votingMetadata = JSON.parse(JSON.stringify(votingMetadataTemplate)) as VotingMetadata;
  let registrationMetadata = JSON.parse(JSON.stringify(registrationMetadataTemplate)) as RegistrationMetadata;

  registrationMetadata.chain_id = String(await deployer.getChainId());
  votingMetadata.chain_id = String(await deployer.getChainId());

  const computedSalt = ethers.id(`${DEPLOYMENT_SALT}`);

  registrationMetadata.contract_address = await votingFactory.predictAddress(
    REGISTRATION_TYPE,
    await signer.getAddress(),
    computedSalt,
  );

  let pinaData = await uploadJSONToIPFS(registrationMetadata, `registration-${DEPLOYMENT_SALT}`);

  let defaultRegParams: IRegistration.RegistrationParamsStruct = {
    remark: `${BASE_IPFS_URI}${pinaData.IpfsHash}`,
    commitmentStart: REG_START_TIMESTAMP,
    commitmentPeriod: DURATION,
  };

  await votingFactory.createRegistrationWithSalt(
    REGISTRATION_TYPE,
    Registration__factory.createInterface().encodeFunctionData("__Registration_init", [defaultRegParams]),
    computedSalt,
  );

  votingMetadata.contract_address = await votingFactory.predictAddress(
    REGISTRATION_TYPE,
    await signer.getAddress(),
    computedSalt,
  );

  pinaData = await uploadJSONToIPFS(votingMetadata, `voting-${DEPLOYMENT_SALT}`);

  let defaultVotingParams: IVoting.VotingParamsStruct = {
    remark: `${BASE_IPFS_URI}${pinaData.IpfsHash}`,
    votingStart: REG_START_TIMESTAMP + DURATION + 120,
    votingPeriod: DURATION,
    registration: registrationMetadata.contract_address,
    candidates: Object.keys(votingMetadata.candidates),
  };

  await votingFactory.createVotingWithSalt(
    VOTING_TYPE,
    Voting__factory.createInterface().encodeFunctionData("__Voting_init", [defaultVotingParams]),
    computedSalt,
  );

  summarizeDeployment(registrationMetadata, votingMetadata, defaultRegParams, defaultVotingParams);
};

function summarizeDeployment(
  registrationMetadata: any,
  votingMetadata: any,
  defaultRegParams: any,
  defaultVotingParams: any,
) {
  console.log(`Registration Address: ${registrationMetadata.contract_address}`);
  console.log(`Registration Start Timestamp: ${defaultRegParams.commitmentStart}`);
  console.log(`Registration Duration: ${defaultRegParams.commitmentPeriod}`);

  console.log(`Connected Voting Address: ${votingMetadata.contract_address}`);
  console.log(`Voting Start Timestamp: ${defaultVotingParams.votingStart}`);
  console.log(`Voting Duration: ${defaultVotingParams.votingPeriod}`);
  console.log("---");
}

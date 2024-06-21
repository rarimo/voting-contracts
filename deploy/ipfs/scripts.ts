import { ethers } from "ethers";

import pinataSDK from "@pinata/sdk";

export interface RegistrationMetadata {
  chain_id: string;
  contract_address: string;
  name: string;
  description: string;
  excerpt: string;
  external_url: string;
  isActive: boolean;
  metadata?: any;
}

export interface VotingMetadata {
  candidates: {
    [key: string]: {
      name: string;
      birthday_date: string;
      description: string;
    };
  };
  chain_id: string;
  contract_address: string;
  name: string;
  excerpt: string;
  description: string;
  external_url: string;
  metadata?: any;
}

export const registrationMetadataTemplate: RegistrationMetadata = {
  chain_id: "11155111",
  contract_address: ethers.ZeroAddress,
  name: "Registration Ipsum",
  description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  excerpt: "",
  external_url: "",
  isActive: true,
  metadata: {
    option: "Yes",
    question:
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat:",
  },
};

export const votingMetadataTemplate: VotingMetadata = {
  candidates: {
    "0x2d912d9053151a822ff4bc7ff9715029e09152ed852e1914bcde69dbde6faae2": {
      name: "FIO1",
      birthday_date: "1985-04-12T23:20:50.52Z",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    },
    "0x260ad0aaccd40f93762389602646e4a6d4ea6364553d62f015b01857d77e0ff7": {
      name: "FIO2",
      birthday_date: "1990-07-19T07:15:30.45Z",
      description: "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
  },
  chain_id: "11155111",
  contract_address: ethers.ZeroAddress,
  name: "Voting Ipsum",
  excerpt:
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  description: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  external_url: "https://example.com/voting-event",
};

const pinata = new pinataSDK({ pinataJWTKey: process.env.JWT });

export async function uploadJSONToIPFS(metadata: any, name: any) {
  return pinata.pinJSONToIPFS(metadata);
}

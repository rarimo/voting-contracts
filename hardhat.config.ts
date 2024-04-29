import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

import "@typechain/hardhat";

import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";

import "@solarity/hardhat-migrate";
import "@solarity/hardhat-markup";

import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-abi-exporter";

import "solidity-coverage";

import "tsconfig-paths/register";

import { HardhatUserConfig } from "hardhat/config";

import * as dotenv from "dotenv";
dotenv.config();

function privateKey() {
  return process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];
}

const config: HardhatUserConfig = {
  paths: {
    deployPaths: "deploy-zkSync",
  },
  networks: {
    hardhat: {
      initialDate: "1970-01-01T00:00:00Z",
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      gasMultiplier: 1.2,
    },
    qDevnet: {
      url: "https://rpc.qdevnet.org/",
      accounts: privateKey(),
    },
    qTestnet: {
      url: "https://rpc.qtestnet.org/",
      accounts: privateKey(),
    },
    qMainnet: {
      url: "https://rpc.q.org",
      accounts: privateKey(),
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: privateKey(),
      gasMultiplier: 1.2,
    },
    zkTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
    },
  },
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  zksolc: {
    settings: {
      forceEvmla: true,
      libraries: {
        // zkSync Testnet
        "@iden3/contracts/lib/Poseidon.sol": {
          PoseidonUnit1L: "0x0000000000000000000000000000000000000001",
          PoseidonUnit2L: "0x0000000000000000000000000000000000000001",
          PoseidonUnit3L: "0x0000000000000000000000000000000000000001",
          PoseidonUnit4L: "0x0000000000000000000000000000000000000001",
          PoseidonUnit5L: "0x0000000000000000000000000000000000000001",
          PoseidonUnit6L: "0x0000000000000000000000000000000000000001",
          SpongePoseidon: "0x0000000000000000000000000000000000000001",
          PoseidonFacade: "0x0000000000000000000000000000000000000001",
        },
      },
    },
  },
  etherscan: {
    apiKey: {
      qDevnet: "abc",
      qTestnet: "abc",
      qMainnet: "abc",
      sepolia: `${process.env.ETHERSCAN_KEY}`,
    },
    customChains: [
      {
        network: "qDevnet",
        chainId: 35442,
        urls: {
          apiURL: "https://explorer.qdevnet.org/api",
          browserURL: "https://explorer.qdevnet.org",
        },
      },
      {
        network: "qTestnet",
        chainId: 35443,
        urls: {
          apiURL: "https://explorer.qtestnet.org/api",
          browserURL: "https://explorer.qtestnet.org",
        },
      },
      {
        network: "qMainnet",
        chainId: 35441,
        urls: {
          apiURL: "https://explorer.q.org/api",
          browserURL: "https://explorer.q.org",
        },
      },
    ],
  },
  migrate: {
    pathToMigrations: "./deploy/",
  },
  mocha: {
    timeout: 1000000,
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 50,
    enabled: false,
    coinmarketcap: `${process.env.COINMARKETCAP_KEY}`,
  },
  typechain: {
    outDir: "generated-types",
    target: "ethers-v6",
  },
  abiExporter: {
    flat: true,
  },
};

export default config;

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    flowTestnet: {
      url: process.env.EVM_RPC_URL || "https://testnet.evm.nodes.onflow.org",
      accounts: process.env.EVM_DEPLOYER_PRIVATE_KEY
        ? [process.env.EVM_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 545,
    },
    flowMainnet: {
      url: "https://mainnet.evm.nodes.onflow.org",
      accounts: process.env.EVM_DEPLOYER_PRIVATE_KEY
        ? [process.env.EVM_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 747,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./evm/contracts",
    tests: "./tests/evm",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;

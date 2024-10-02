import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("@chainlink/env-enc").config()
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat"


const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    avalancheFuji: {
        url: "https://api.avax-test.network/ext/bc/C/rpc", 
        accounts: [process.env.PRIVATE_KEY ?? ""], 
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};

export default config;

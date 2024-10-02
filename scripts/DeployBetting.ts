import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";

async function main() {
  const resultsConsumerAddress = "0x7006287ed8E35818f122232EF40017D3f78c9199";
  
  const SoccerBetting = await ethers.getContractFactory("SoccerBetting");
  const soccerBetting = await SoccerBetting.deploy(resultsConsumerAddress);
  await soccerBetting.deployed();
  
  console.log("SoccerBetting deployed to:", soccerBetting.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
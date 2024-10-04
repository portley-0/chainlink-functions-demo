import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { SoccerBetting__factory } from "../typechain-types";

async function main() {
  const CONTRACT_ADDRESS = '0x78B7B2c04ED93dA8856390f3EF3b0633fCe6E36d';
  
  const matchId =   1231794; 
  const timestamp = 1728069300; 
  const result = 1; 
  const betAmount = ethers.utils.parseEther("0.0001");

  const [signer] = await ethers.getSigners();
  console.log("Placing bet from account:", signer.address);

  const soccerBetting = SoccerBetting__factory.connect(CONTRACT_ADDRESS, signer);

  try {
    const tx = await soccerBetting.smartBet(matchId, timestamp, result, { value: betAmount });
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
  } catch (error) {
    console.error("Error placing bet:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
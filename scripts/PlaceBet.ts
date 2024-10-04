import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { SoccerBetting__factory } from "../typechain-types";

async function main() {
  const CONTRACT_ADDRESS = '0x0B6B504a3762902b7362dAAe6d288DCDA9bE409F';
  
  const matchId = 1208847; 
  const timestamp = 1728000000; 
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
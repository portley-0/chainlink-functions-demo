import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { SoccerBetting } from '../typechain-types';

const CONTRACT_ADDRESS = '0x78B7B2c04ED93dA8856390f3EF3b0633fCe6E36d';

const MatchState = ['Active', 'ResultRequested', 'Resolved'];
const Result = ['Draw', 'Home', 'Away'];

async function getMatchDetails(matchId: number) {
    try {
        
        const contract: SoccerBetting = await ethers.getContractAt("SoccerBetting", CONTRACT_ADDRESS);

        console.log(`Fetching details for match ID: ${matchId}`);
        
        const [startTime, state, result, totalWagerAmount] = await contract.getMatchDetails(matchId);
        
        const startTimeDate = new Date(startTime.toNumber() * 1000);

        console.log('Match Details:');
        console.log('---------------------');
        console.log(`Start Time: ${startTimeDate.toLocaleString()}`);
        console.log(`State: ${MatchState[state]}`);
        console.log(`Result: ${Result[result]}`);
        console.log(`Total Wager Amount: ${ethers.utils.formatEther(totalWagerAmount)} ETH`);

        const currentTime = new Date();
        console.log('\nDebug Information:');
        console.log('---------------------');
        console.log(`Current Time: ${currentTime.toLocaleString()}`);
        console.log(`Time Elapsed Since Start: ${(currentTime.getTime() - startTimeDate.getTime()) / 1000 / 60} minutes`);
        
        const MATCH_DURATION = 2 * 60 * 60; 
        console.log(`Time Until Result Request: ${(MATCH_DURATION - (currentTime.getTime() - startTimeDate.getTime()) / 1000) / 60} minutes`);

        if (currentTime.getTime() - startTimeDate.getTime() > MATCH_DURATION * 1000) {
            console.log('\nNOTE: Match duration has passed. This match should be eligible for result request.');
        }

    } catch (error) {
        console.error('Error fetching match details:', error);
    }
}

async function main() {
    await getMatchDetails(1231794);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
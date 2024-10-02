import '@nomiclabs/hardhat-ethers';
import { expect } from "chai";
import { ethers } from "hardhat";
import { SoccerBetting, SoccerBetting__factory, MockResultsConsumer, MockResultsConsumer__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

describe("SoccerBetting", function () {
  let soccerBetting: SoccerBetting;
  let mockResultsConsumer: MockResultsConsumer;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const MIN_WAGER = ethers.utils.parseUnits("10000", "gwei");
  const MAX_WAGER = ethers.utils.parseUnits("10000000", "gwei");
  const MATCH_DURATION = 2 * 60 * 60; 
  const RESULT_REQUEST_DELAY = 60; 

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockResultsConsumer = await ethers.getContractFactory("MockResultsConsumer") as MockResultsConsumer__factory;
    mockResultsConsumer = await MockResultsConsumer.deploy();
    await mockResultsConsumer.deployed();

    const SoccerBettingFactory = await ethers.getContractFactory("SoccerBetting") as SoccerBetting__factory;
    soccerBetting = await SoccerBettingFactory.deploy(mockResultsConsumer.address);
    await soccerBetting.deployed();
  });

  async function getTime() {
    const latestBlock = await ethers.provider.getBlock("latest");
    return latestBlock.timestamp;
  }

  async function incrementTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  describe("smartBet", function () {
    it("Should create a new match and place a bet", async function () {
      const matchId = 1;
      const startTime = (await getTime()) + 3600; 
      const betAmount = MIN_WAGER;

      await expect(soccerBetting.connect(addr1).smartBet(matchId, startTime, 1, { value: betAmount }))
        .to.emit(soccerBetting, "MatchCreated")
        .withArgs(matchId, BigNumber.from(startTime))
        .to.emit(soccerBetting, "BetPlaced")
        .withArgs(matchId, addr1.address, 1, betAmount);

      const matchDetails = await soccerBetting.getMatchDetails(matchId);
      expect(matchDetails.startTime).to.equal(BigNumber.from(startTime));
      expect(matchDetails.state).to.equal(0); // Active
      expect(matchDetails.totalWagerAmount).to.equal(betAmount);
    });

    it("Should fail if bet amount is less than MIN_WAGER", async function () {
      const matchId = 1;
      const startTime = (await getTime()) + 3600;
      const betAmount = MIN_WAGER.sub(1);

      await expect(soccerBetting.connect(addr1).smartBet(matchId, startTime, 1, { value: betAmount }))
        .to.be.revertedWith("Bet amount must be greater than or equal to MIN_WAGER");
    });

    it("Should fail if bet amount is more than MAX_WAGER", async function () {
      const matchId = 1;
      const startTime = (await getTime()) + 3600;
      const betAmount = MAX_WAGER.add(1);

      await expect(soccerBetting.connect(addr1).smartBet(matchId, startTime, 1, { value: betAmount }))
        .to.be.revertedWith("Bet amount must be less than or equal to MAX_WAGER");
    });
  });

  describe("checkUpkeep, performUpkeep, and winnings payout", function () {
    it("Should request result, resolve match, and payout winnings", async function () {
      const matchId = 1;
      const startTime = (await getTime()) + 3600; 
      const betAmount = MAX_WAGER

      await soccerBetting.connect(addr1).smartBet(matchId, startTime, 1, { value: betAmount }); // Home win
      await soccerBetting.connect(addr2).smartBet(matchId, startTime, 2, { value: betAmount }); // Away win

      await incrementTime(3600 + MATCH_DURATION + 1);

      const [upkeepNeeded, performData] = await soccerBetting.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;

      await expect(soccerBetting.performUpkeep(performData))
        .to.emit(soccerBetting, "ResultRequested")
        .withArgs(matchId);

      // Simulate Chainlink Functions response
      const tx = await mockResultsConsumer.requestMatchResult(matchId);
      const receipt = await tx.wait();

      const event = receipt.events?.find(event => event.event === "RequestedResult");
      
      if (event?.args) {
        const requestId = event.args[1];
        await mockResultsConsumer.fulfillRequest(requestId, 1); // Home win
      } else {
        throw new Error("RequestedResult event or its args not found in receipt");
      }

      // Fast forward time again
      await incrementTime(RESULT_REQUEST_DELAY + 1);

      // Check upkeep again
      const [upkeepNeeded2, performData2] = await soccerBetting.checkUpkeep("0x");
      expect(upkeepNeeded2).to.be.true;

      // Perform upkeep to resolve match and payout winnings
      const resolveTx = await soccerBetting.performUpkeep(performData2);
      const resolveReceipt = await resolveTx.wait();

      // Check for MatchResolved and WinningsClaimed events
      const matchResolvedEvent = resolveReceipt.events?.find(e => e.event === "MatchResolved");
      const winningsClaimedEvent = resolveReceipt.events?.find(e => e.event === "WinningsClaimed");

      expect(matchResolvedEvent).to.exist;
      expect(matchResolvedEvent?.args?.matchId).to.equal(matchId);
      expect(matchResolvedEvent?.args?.result).to.equal(1); // Home win

      expect(winningsClaimedEvent).to.exist;
      expect(winningsClaimedEvent?.args?.matchId).to.equal(matchId);
      expect(winningsClaimedEvent?.args?.bettor).to.equal(addr1.address);
      expect(winningsClaimedEvent?.args?.amount).to.equal(betAmount.mul(2));

      // Check match state
      const matchDetails = await soccerBetting.getMatchDetails(matchId);
      expect(matchDetails.state).to.equal(2); // Resolved
      expect(matchDetails.result).to.equal(1); // Home win

      // Check that winning bet is marked as claimed
      const addr1Bets = await soccerBetting.getUserResolvedBets(addr1.address);
      expect(addr1Bets.length).to.equal(1);
      expect(addr1Bets[0].claimed).to.be.true;

      // Check that losing bet is not marked as claimed
      const addr2Bets = await soccerBetting.getUserResolvedBets(addr2.address);
      expect(addr2Bets.length).to.equal(1);
      expect(addr2Bets[0].claimed).to.be.false;
    });
  });

  describe("getUserActiveBets and getUserResolvedBets", function () {
    it("Should return correct active and resolved bets for a user", async function () {
      const matchId1 = 1;
      const matchId2 = 2;
      const currentTime = await getTime();
      const startTime1 = currentTime + 3600;
      const startTime2 = currentTime + 7200; // 2 hours after the first match
  
      // Place bets
      await soccerBetting.connect(addr1).smartBet(matchId1, startTime1, 1, { value: MIN_WAGER });
      await soccerBetting.connect(addr1).smartBet(matchId2, startTime2, 2, { value: MIN_WAGER });
  
      // Check active bets
      const activeBets = await soccerBetting.getUserActiveBets(addr1.address);
      expect(activeBets.length).to.equal(2);
      expect(activeBets[0].matchId).to.equal(matchId1);
      expect(activeBets[1].matchId).to.equal(matchId2);
  
      // Resolve first match
      await incrementTime(3600 + MATCH_DURATION + 1);
  
      const [, performData] = await soccerBetting.checkUpkeep("0x");
      await soccerBetting.performUpkeep(performData);
  
      const tx = await mockResultsConsumer.requestMatchResult(matchId1);
      const receipt = await tx.wait();
  
      const event = receipt.events?.find(event => event.event === "RequestedResult");
      if (event?.args) {
        const requestId = event.args[1];
        await mockResultsConsumer.fulfillRequest(requestId, 1); // Home win
      } else {
        throw new Error("RequestedResult event or its args not found in receipt");
      }
  
      await incrementTime(RESULT_REQUEST_DELAY + 1);
  
      const [, performData2] = await soccerBetting.checkUpkeep("0x");
      await soccerBetting.performUpkeep(performData2);
  
      // Check active and resolved bets
      const newActiveBets = await soccerBetting.getUserActiveBets(addr1.address);
      expect(newActiveBets.length).to.equal(1);
      expect(newActiveBets[0].matchId).to.equal(matchId2);
  
      const resolvedBets = await soccerBetting.getUserResolvedBets(addr1.address);
      expect(resolvedBets.length).to.equal(1);
      expect(resolvedBets[0].matchId).to.equal(matchId1);
      
      // Check if the resolved bet is claimed or not
      const matchDetails = await soccerBetting.getMatchDetails(matchId1);
      if (resolvedBets[0].result === matchDetails.result) {
        expect(resolvedBets[0].claimed).to.be.true;
      } else {
        expect(resolvedBets[0].claimed).to.be.false;
      }
    });
  });
});
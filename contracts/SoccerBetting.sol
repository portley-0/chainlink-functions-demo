// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

interface IResultsConsumer {
    function requestMatchResult(uint256 matchId) external;
    function returnResult(uint256 matchId) external view returns (uint8);
}

contract SoccerBetting is AutomationCompatibleInterface {
    IResultsConsumer public resultsConsumer;

    uint256 private constant MIN_WAGER = 10000 gwei; 
    uint256 private constant MAX_WAGER = 10000000 gwei; 
    uint256 public constant MATCH_DURATION = 2 hours;
    uint256 public constant RESULT_REQUEST_DELAY = 1 minutes;

    mapping(uint256 => Match) private matches;
    mapping(uint256 => Bet[]) private matchBets;
    mapping(address => mapping(uint256 => uint256[])) private userBetIndices;

    uint256[] private activeGames;
    uint256[] private resolvedGames;

    enum MatchState { Active, ResultRequested, Resolved }
    enum Result { Draw, Home, Away }

    struct Match {
        uint256 matchId;
        uint256 startTime;
        uint256 awayWagerAmount;
        uint256 homeWagerAmount;
        uint256 drawWagerAmount;
        uint256 totalWagerAmount;
        MatchState state;
        Result result;
        uint256 resultRequestTime;
    }

    struct Bet {
        uint256 matchId;
        address bettor;
        uint256 amount;
        Result result;
        bool claimed;
    }

    event MatchCreated(uint256 indexed matchId, uint256 startTime);
    event BetPlaced(uint256 indexed matchId, address indexed bettor, Result result, uint256 amount);
    event ResultRequested(uint256 indexed matchId);
    event MatchResolved(uint256 indexed matchId, Result result);
    event WinningsClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount);

    event LogCheckUpkeep(uint256 matchId, MatchState state, uint256 currentTime, uint256 startTime, uint256 resultRequestTime);
    event LogPerformUpkeep(uint256 matchId, uint8 action);
    event LogRequestResult(uint256 matchId, bool success);
    event LogRetrieveResultAndPayout(uint256 matchId, uint8 resultValue, Result result);
    event LogPayoutWinnings(uint256 matchId, uint256 winningPool, uint256 totalPayout);

    event ReceivedPerformUpkeep(bytes performData);

    constructor(address _resultsConsumerAddress) {
        resultsConsumer = IResultsConsumer(_resultsConsumerAddress);
    }

    function smartBet(uint256 matchId, uint256 timestamp, Result result) external payable {
        require(msg.value >= MIN_WAGER, "Bet amount must be greater than or equal to MIN_WAGER");
        require(msg.value <= MAX_WAGER, "Bet amount must be less than or equal to MAX_WAGER");

        Match storage gameMatch = matches[matchId];

        if (gameMatch.startTime == 0) {
            _createMatch(matchId, timestamp);
        } else {
            require(gameMatch.startTime > block.timestamp, "Match has already started");
        }

        _placeBet(matchId, result, msg.value);
    }

    function _createMatch(uint256 matchId, uint256 timestamp) internal {
        require(matches[matchId].startTime == 0, "Match already exists");
        require(timestamp > block.timestamp, "Start time must be in the future");

        matches[matchId] = Match({
            matchId: matchId,
            startTime: timestamp,
            awayWagerAmount: 0,
            homeWagerAmount: 0,
            drawWagerAmount: 0,
            totalWagerAmount: 0,
            state: MatchState.Active,
            result: Result.Draw,
            resultRequestTime: 0
        });

        activeGames.push(matchId);
        emit MatchCreated(matchId, timestamp);
    }

    function _placeBet(uint256 matchId, Result result, uint256 amount) internal {
        Match storage gameMatch = matches[matchId];
        require(gameMatch.startTime > block.timestamp, "Match has already started");

        if (result == Result.Home) {
            gameMatch.homeWagerAmount += amount;
        } else if (result == Result.Away) {
            gameMatch.awayWagerAmount += amount;
        } else {
            gameMatch.drawWagerAmount += amount;
        }

        gameMatch.totalWagerAmount += amount;
        
        uint256 betIndex = matchBets[matchId].length;
        matchBets[matchId].push(Bet(matchId, msg.sender, amount, result, false));
        userBetIndices[msg.sender][matchId].push(betIndex);

        emit BetPlaced(matchId, msg.sender, result, amount);
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory eligibleMatches = new uint256[](activeGames.length);
        uint256 count = 0;

        for (uint256 i = 0; i < activeGames.length; i++) {
            uint256 matchId = activeGames[i];
            Match storage gameMatch = matches[matchId];
            
            if ((gameMatch.state == MatchState.Active && block.timestamp >= gameMatch.startTime + MATCH_DURATION) ||
                (gameMatch.state == MatchState.ResultRequested && block.timestamp >= gameMatch.resultRequestTime + RESULT_REQUEST_DELAY)) {
                eligibleMatches[count] = matchId;
                count++;
            }
        }

        if (count > 0) {
            return (true, abi.encode(eligibleMatches));
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        emit ReceivedPerformUpkeep(performData);
        uint256[] memory matchIds = abi.decode(performData, (uint256[]));

        for (uint256 i = 0; i < matchIds.length; i++) {
            uint256 matchId = matchIds[i];
            if (matchId == 0) break; 

            Match storage gameMatch = matches[matchId];

            if (gameMatch.state == MatchState.Active && block.timestamp >= gameMatch.startTime + MATCH_DURATION) {
                _requestResult(matchId);
            } else if (gameMatch.state == MatchState.ResultRequested && block.timestamp >= gameMatch.resultRequestTime + RESULT_REQUEST_DELAY) {
                _retrieveResultAndPayout(matchId);
            }
        }
    }


    function _requestResult(uint256 matchId) internal {
        Match storage gameMatch = matches[matchId];
        require(gameMatch.state == MatchState.Active, "Match not in active state");
        require(block.timestamp >= gameMatch.startTime + MATCH_DURATION, "Match not finished yet");

        bool success = true;
        try resultsConsumer.requestMatchResult(matchId) {
        } catch {
            success = false;
        }

        emit LogRequestResult(matchId, success);

        if (success) {
            gameMatch.state = MatchState.ResultRequested;
            gameMatch.resultRequestTime = block.timestamp;
            emit ResultRequested(matchId);
        }
    }

    function _retrieveResultAndPayout(uint256 matchId) internal {
        Match storage gameMatch = matches[matchId];
        require(gameMatch.state == MatchState.ResultRequested, "Result not requested");
        require(block.timestamp >= gameMatch.resultRequestTime + RESULT_REQUEST_DELAY, "Too early to retrieve result");

        uint8 resultValue;
        bool success = true;
        try resultsConsumer.returnResult(matchId) returns (uint8 _resultValue) {
            resultValue = _resultValue;
        } catch {
            success = false;
        }

        emit LogRetrieveResultAndPayout(matchId, resultValue, Result(resultValue));

        if (success && resultValue <= 2) {
            Result result = Result(resultValue);
            gameMatch.result = result;
            gameMatch.state = MatchState.Resolved;

            emit MatchResolved(matchId, result);

            _payoutWinnings(matchId);

            for (uint256 i = 0; i < activeGames.length; i++) {
                if (activeGames[i] == matchId) {
                    activeGames[i] = activeGames[activeGames.length - 1];
                    activeGames.pop();
                    break;
                }
            }
            resolvedGames.push(matchId);
        }
    }

    function _payoutWinnings(uint256 matchId) internal {
        Match storage gameMatch = matches[matchId];
        require(gameMatch.state == MatchState.Resolved, "Match not resolved");

        uint256 winningPool;
        if (gameMatch.result == Result.Home) {
            winningPool = gameMatch.homeWagerAmount;
        } else if (gameMatch.result == Result.Away) {
            winningPool = gameMatch.awayWagerAmount;
        } else {
            winningPool = gameMatch.drawWagerAmount;
        }

        emit LogPayoutWinnings(matchId, winningPool, gameMatch.totalWagerAmount);

        if (winningPool == 0) return; 

        uint256 totalPayout = gameMatch.totalWagerAmount;

        Bet[] storage bets = matchBets[matchId];
        for (uint256 i = 0; i < bets.length; i++) {
            Bet storage bet = bets[i];
            if (!bet.claimed && bet.result == gameMatch.result) {
                uint256 winnings = (bet.amount * totalPayout) / winningPool;
                bet.claimed = true;
                payable(bet.bettor).transfer(winnings);
                emit WinningsClaimed(matchId, bet.bettor, winnings);
            }
        }
    }

    function getMatchDetails(uint256 matchId) external view returns (uint256 startTime, MatchState state, Result result, uint256 totalWagerAmount) {
        Match storage gameMatch = matches[matchId];
        return (gameMatch.startTime, gameMatch.state, gameMatch.result, gameMatch.totalWagerAmount);
    }

    function getUserActiveBets(address user) external view returns (Bet[] memory) {
        uint256 activeBetCount = 0;
        
        for (uint256 i = 0; i < activeGames.length; i++) {
            uint256 matchId = activeGames[i];
            activeBetCount += userBetIndices[user][matchId].length;
        }
        
        Bet[] memory userActiveBets = new Bet[](activeBetCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < activeGames.length; i++) {
            uint256 matchId = activeGames[i];
            uint256[] storage indices = userBetIndices[user][matchId];
            for (uint256 j = 0; j < indices.length; j++) {
                userActiveBets[currentIndex] = matchBets[matchId][indices[j]];
                currentIndex++;
            }
        }
        
        return userActiveBets;
    }

    function getUserResolvedBets(address user) external view returns (Bet[] memory) {
        uint256 resolvedBetCount = 0;
        
        for (uint256 i = 0; i < resolvedGames.length; i++) {
            uint256 matchId = resolvedGames[i];
            resolvedBetCount += userBetIndices[user][matchId].length;
        }
        
        Bet[] memory userResolvedBets = new Bet[](resolvedBetCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < resolvedGames.length; i++) {
            uint256 matchId = resolvedGames[i];
            uint256[] storage indices = userBetIndices[user][matchId];
            for (uint256 j = 0; j < indices.length; j++) {
                userResolvedBets[currentIndex] = matchBets[matchId][indices[j]];
                currentIndex++;
            }
        }
        
        return userResolvedBets;
    }
}
'use client'
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useMetaMask } from '../context/MetaMask';
import { ethers } from 'ethers';
import { SoccerBetting, SoccerBetting__factory } from "../../typechain-types";

interface Team {
  id: number;
  name: string;
  logo: string;
}

interface Fixture {
  id: number;
  timestamp: number;
  date: string;
}

interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  round: string;
}

interface Match {
  fixture: Fixture;
  league: League;
  teams: {
    home: Team;
    away: Team;
  };
}

type ApiResponse = {
  response: Match[];
}

enum Result {
  Draw,
  Home,
  Away
}

const CONTRACT_ADDRESS = '0x78B7B2c04ED93dA8856390f3EF3b0633fCe6E36d';

const LEAGUE_IDS = [2, 3, 39, 78, 357, 358];
const SEASON = '2024';

const MatchList: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [betAmount, setBetAmount] = useState<string>('');
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const { isConnected, connectWallet } = useMetaMask();

  useEffect(() => {
    const fetchMatches = async () => {
      console.log("Fetching matches...");
      try {
        const today = new Date();
        const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        
        const allMatches: Match[] = [];

        for (const leagueId of LEAGUE_IDS) {
          const response = await axios.get<ApiResponse>("https://v3.football.api-sports.io/fixtures", {
            headers: {
              "x-apisports-key": process.env.NEXT_PUBLIC_API_KEY
            },
            params: {
              league: leagueId,
              season: SEASON,
              status: "NS",
              from: today.toISOString().split('T')[0],
              to: twoWeeksLater.toISOString().split('T')[0]
            }
          });

          console.log(`API Response received for league ${leagueId}:`, response.data);
          if (response.data.response && Array.isArray(response.data.response)) {
            allMatches.push(...response.data.response);
          } else {
            console.warn(`Unexpected API response format for league ${leagueId}:`, response.data);
          }
        }

        setMatches(allMatches);
        console.log("Total matches set:", allMatches.length);
        
        loadImages(allMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
        if (axios.isAxiosError(error)) {
          setError(`Failed to fetch matches: ${error.message}`);
          console.error("Axios error details:", error.response?.data);
        } else {
          setError("An unexpected error occurred");
        }
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const loadImages = (matches: Match[]) => {
    const imageUrls = matches.flatMap(match => [
      match.league.logo,
      match.teams.home.logo,
      match.teams.away.logo
    ]);

    let loadedCount = 0;
    const totalImages = imageUrls.length;

    imageUrls.forEach(url => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          setImagesLoaded(true);
          setLoading(false);
        }
      };
      img.src = url;
    });
  };

  const handlePrediction = (match: Match, result: Result) => {
    setSelectedMatch(match);
    setSelectedResult(result);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedMatch(null);
    setSelectedResult(null);
    setBetAmount('');
  };

  const handleBet = async () => {
    if (!isConnected || !selectedMatch || selectedResult === null || !betAmount) {
      console.error("Invalid bet parameters");
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      console.error("MetaMask is not installed");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract: SoccerBetting = SoccerBetting__factory.connect(CONTRACT_ADDRESS, signer);

      const betAmountWei = ethers.utils.parseEther(betAmount);
      const matchId = selectedMatch.fixture.id;
      const timestamp = selectedMatch.fixture.timestamp;

      console.log("Placing bet with result:", selectedResult); 

      const tx = await contract.smartBet(matchId, timestamp, selectedResult, { value: betAmountWei });
      console.log("Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("Transaction receipt:", receipt);

      console.log("Bet placed successfully");
      closeModal();
    } catch (error) {
      console.error("Error placing bet:", error);
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  console.log("Rendering component. Loading:", loading, "Error:", error, "Matches:", matches.length, "Images Loaded:", imagesLoaded);

  if (loading || !imagesLoaded) return (
    <div className="flex justify-center items-center h-64">
      <span className="loading loading-spinner text-blue-700 h-10 w-10 "></span>
    </div>
  );
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;
  if (matches.length === 0) return <div className="text-center p-4">No upcoming matches available</div>;

  return (
    <div className="p-2 relative">
      {matches.map((match) => (
        <div key={match.fixture.id} className="bg-gray-700 shadow-md rounded-lg p-2 mb-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="league-info flex items-center">
              <img src={match.league.logo} alt={match.league.name} className="w-6 h-6 mr-2" />
              <span className="font-semibold text-sm">{match.league.name}</span>
            </div>
            <span className="text-xs">{formatDateTime(match.fixture.date)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center w-2/5">
              <img src={match.teams.home.logo} className="w-16 h-16 object-contain mr-2" />
              <span className="text-sm font-semibold truncate">{match.teams.home.name}</span>
            </div>
            <span className="text-sm font-bold">vs</span>
            <div className="flex items-center justify-end w-2/5">
              <span className="text-sm font-semibold truncate">{match.teams.away.name}</span>
              <img src={match.teams.away.logo} className="w-16 h-16 object-contain ml-2" />
            </div>
          </div>
          <div className="flex justify-between">
            <button 
              onClick={() => handlePrediction(match, Result.Home)}
              className="btn btn-sm w-20 bg-blue-600 hover:bg-blue-600 text-white font-bold rounded-lg border-transparent hover:border-transparent"
            >
              Home 
            </button>
            <button 
              onClick={() => handlePrediction(match, Result.Draw)}
              className="btn btn-sm w-20 bg-gray-600 hover:bg-gray-600 text-white font-bold rounded-lg border-transparent hover:border-transparent"
            >
              Draw
            </button>
            <button 
              onClick={() => handlePrediction(match, Result.Away)}
              className="btn btn-sm w-20 bg-red-600 hover:bg-red-600 text-white font-bold rounded-lg border-transparent hover:border-transparent"
            >
              Away
            </button>
          </div>
        </div>
      ))}

      {modalIsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-700 p-6 rounded-lg max-w-sm w-full">
            {isConnected ? (
              <div>
                <h2 className="text-xl font-bold mb-4">Place Your Bet</h2>
                {selectedMatch && (
                  <div className="mb-4">
                    <p className="font-semibold">{selectedMatch.teams.home.name} vs {selectedMatch.teams.away.name}</p>
                    <p>Your Prediction: {Result[selectedResult ?? 0]}</p>
                  </div>
                )}
                <div className="mb-4">
                  <label htmlFor="betAmount" className="block mb-2">Bet Amount (AVAX):</label>
                  <input
                    type="number"
                    id="betAmount"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full p-2 rounded bg-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    step="0.01"
                    min="0"
                  />
                </div>
                <button
                  onClick={handleBet}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
                >
                  Place Bet
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold mb-4">Connect MetaMask</h2>
                <p className="mb-4">Please connect your MetaMask wallet to place a bet.</p>
                <button
                  onClick={connectWallet}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
                >
                  Connect MetaMask
                </button>
              </div>
            )}
            <button
              onClick={closeModal}
              className="mt-4 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-500 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchList;
'use client'
import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { ethers } from 'ethers';
import axios from 'axios';
import { SoccerBetting, SoccerBetting__factory } from "../../typechain-types";
import { useMetaMask } from '../context/MetaMask';

const CONTRACT_ADDRESS = '0x78B7B2c04ED93dA8856390f3EF3b0633fCe6E36d';

interface MatchInfo {
  home: { name: string; logo: string };
  away: { name: string; logo: string };
}

type ContractBet = {
  matchId: ethers.BigNumber;
  bettor: string;
  amount: ethers.BigNumber;
  result: number;
}

interface EnhancedBet extends ContractBet {
  matchInfo?: MatchInfo;
  logosLoaded?: boolean;
}

const Predictions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');
  const [activeBets, setActiveBets] = useState<EnhancedBet[]>([]);
  const [resolvedBets, setResolvedBets] = useState<EnhancedBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useMetaMask();

  const fetchBets = useCallback(async (tabType: 'active' | 'resolved') => {
    if (!isConnected) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Ethereum object not found. Please install MetaMask.');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract: SoccerBetting = SoccerBetting__factory.connect(CONTRACT_ADDRESS, signer);

      const fetchedBets = tabType === 'active' 
        ? await contract.getUserActiveBets(await signer.getAddress())
        : await contract.getUserResolvedBets(await signer.getAddress());
      
      const enhancedBets: EnhancedBet[] = fetchedBets.map(bet => ({
        matchId: bet.matchId,
        bettor: bet.bettor,
        amount: bet.amount,
        result: bet.result
      }));
      
      return enhancedBets;
    } catch (error) {
      console.error(`Error fetching ${tabType} bets:`, error);
      setError(`Failed to fetch ${tabType} bets. Please try again.`);
    }
  }, [isConnected]);

  const fetchMatchInfo = useCallback(async (matchId: number): Promise<MatchInfo | undefined> => {
    try {
      const response = await axios.get("https://v3.football.api-sports.io/fixtures", {
        headers: {
          "x-apisports-key": process.env.NEXT_PUBLIC_API_KEY
        },
        params: {
          id: matchId
        }
      });

      if (response.data.response && response.data.response.length > 0) {
        const match = response.data.response[0];
        return {
          home: { name: match.teams.home.name, logo: match.teams.home.logo },
          away: { name: match.teams.away.name, logo: match.teams.away.logo }
        };
      }
    } catch (error) {
      console.error(`Error fetching match info for match ID ${matchId}:`, error);
    }
    return undefined;
  }, []);

  const enhanceBetsWithMatchInfo = useCallback(async (bets: EnhancedBet[]): Promise<EnhancedBet[]> => {
    return await Promise.all(
      bets.map(async (bet) => {
        if (!bet.matchInfo) {
          const matchInfo = await fetchMatchInfo(bet.matchId.toNumber());
          return { ...bet, matchInfo };
        }
        return bet;
      })
    );
  }, [fetchMatchInfo]);

  const checkLogosLoaded = (bet: EnhancedBet): Promise<EnhancedBet> => {
    return new Promise((resolve) => {
      if (!bet.matchInfo) {
        resolve({ ...bet, logosLoaded: false });
        return;
      }

      const homeLogo = new Image();
      const awayLogo = new Image();
      let loadedCount = 0;

      const onLoad = () => {
        loadedCount++;
        if (loadedCount === 2) {
          resolve({ ...bet, logosLoaded: true });
        }
      };

      const onError = () => {
        resolve({ ...bet, logosLoaded: false });
      };

      homeLogo.onload = onLoad;
      homeLogo.onerror = onError;
      awayLogo.onload = onLoad;
      awayLogo.onerror = onError;

      homeLogo.src = bet.matchInfo.home.logo;
      awayLogo.src = bet.matchInfo.away.logo;
    });
  };

  const loadBets = useCallback(async (tabType: 'active' | 'resolved') => {
    setIsLoading(true);
    try {
      const fetchedBets = await fetchBets(tabType);
      if (fetchedBets) {
        const enhancedBets = await enhanceBetsWithMatchInfo(fetchedBets);
        const betsWithLogosLoaded = await Promise.all(enhancedBets.map(checkLogosLoaded));
        if (tabType === 'active') {
          setActiveBets(betsWithLogosLoaded);
        } else {
          setResolvedBets(betsWithLogosLoaded);
        }
      }
    } catch (error) {
      console.error('Error loading bets:', error);
      setError('Failed to load bet information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchBets, enhanceBetsWithMatchInfo]);

  useEffect(() => {
    loadBets(activeTab);
  }, [activeTab, isConnected, loadBets]);

  const handleRefresh = useCallback(() => {
    loadBets(activeTab);
  }, [activeTab, loadBets]);

  const renderBets = () => {
    if (!isConnected) {
      return <p className="text-white text-center">Connect wallet to view bets.</p>;
    }

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-full">
          <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
        </div>
      );
    }

    const betsToRender = activeTab === 'active' ? activeBets : resolvedBets;

    if (betsToRender.length === 0) {
      return <p className="text-white text-center">No bets to display. Click refresh to load bets.</p>;
    }

    return (
      <div className="space-y-4">
        {betsToRender.filter(bet => bet.logosLoaded).map((bet, index) => (
          <div key={index} className="bg-gray-700 p-4 rounded-lg">
            {bet.matchInfo && (
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center w-2/5">
                  <img src={bet.matchInfo.home.logo} alt={bet.matchInfo.home.name} className="w-8 h-8 object-contain mr-2" />
                  <span className="text-sm font-semibold truncate">{bet.matchInfo.home.name}</span>
                </div>
                <span className="text-sm font-bold">vs</span>
                <div className="flex items-center justify-end w-2/5">
                  <span className="text-sm font-semibold truncate">{bet.matchInfo.away.name}</span>
                  <img src={bet.matchInfo.away.logo} alt={bet.matchInfo.away.name} className="w-8 h-8 object-contain ml-2" />
                </div>
              </div>
            )}
            <p className="text-white">Amount: {ethers.utils.formatEther(bet.amount)} AVAX</p>
            <p className="text-white">Result: {['Draw', 'Home', 'Away'][bet.result]}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className='flex flex-col h-full'>
      <div className="flex items-center bg-gray-700 p-2 rounded-lg mb-4">
        <div className="flex flex-grow space-x-2">
          <button
            className={`flex-1 py-2 px-4 text-center rounded-lg ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Bets
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center rounded-lg ${activeTab === 'resolved' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved Bets
          </button>
        </div>
        <button
          onClick={handleRefresh}
          className={`ml-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoading || !isConnected}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {error && (
        <div className="bg-red-500 text-white p-2 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      <div className="flex-grow overflow-hidden">
        <div className="h-full overflow-y-auto pr-2">
          {renderBets()}
        </div>
      </div>
    </div>
  );
};

export default Predictions;
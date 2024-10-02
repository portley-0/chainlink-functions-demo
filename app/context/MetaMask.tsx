'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: ethers.providers.ExternalProvider & {
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

interface MetaMaskContextType {
  isConnected: boolean;
  account: string | null;
  balance: string;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  isConnecting: boolean;
  switchToAvalancheFuji: () => Promise<void>;
}

const MetaMaskContext = createContext<MetaMaskContextType | undefined>(undefined);

export const MetaMaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState('0.00');
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const getEthereumProvider = (): ethers.providers.Web3Provider | null => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      return new ethers.providers.Web3Provider(window.ethereum);
    }
    return null;
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const provider = getEthereumProvider();
      if (provider) {
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        const network = await provider.getNetwork();

        setAccount(address);
        setBalance(ethers.utils.formatEther(balance));
        setChainId(network.chainId);
        setIsConnected(true);

        // Automatically switch to Avalanche Fuji Testnet after connecting
        await switchToAvalancheFuji();
      } else {
        console.error('MetaMask is not installed');
      }
    } catch (error) {
      console.error('Failed to connect to MetaMask', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToAvalancheFuji = async () => {
    const provider = getEthereumProvider();
    if (provider) {
      try {
        await provider.send('wallet_switchEthereumChain', [{ chainId: '43113' }]); 
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await provider.send('wallet_addEthereumChain', [
              {
                chainId: '43113',
                chainName: 'Avalanche Fuji Testnet',
                nativeCurrency: {
                  name: 'Avalanche',
                  symbol: 'AVAX',
                  decimals: 18
                },
                rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://testnet.snowtrace.io/']
              },
            ]);
          } catch (addError) {
            console.error('Failed to add Avalanche Fuji Testnet', addError);
          }
        } else {
          console.error('Failed to switch to Avalanche Fuji Testnet', switchError);
        }
      }
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      const provider = getEthereumProvider();
      if (provider) {
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          connectWallet();
        }
      }
    };

    checkConnection();

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        connectWallet();
      } else {
        setIsConnected(false);
        setAccount(null);
        setBalance('0.00');
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  return (
    <MetaMaskContext.Provider value={{ isConnected, account, balance, chainId, connectWallet, isConnecting, switchToAvalancheFuji }}>
      {children}
    </MetaMaskContext.Provider>
  );
};

export const useMetaMask = () => {
  const context = useContext(MetaMaskContext);
  if (context === undefined) {
    throw new Error('useMetaMask must be used within a MetaMaskProvider');
  }
  return context;
};
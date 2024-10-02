'use client'
import Image from 'next/image'
import React from 'react';
import { useMetaMask } from '../context/MetaMask';

const TitleBar: React.FC = () => {
  const { isConnected, account, balance, connectWallet, isConnecting } = useMetaMask();

  const handleConnectClick = () => {
    if (!isConnected && !isConnecting) {
      connectWallet();
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="w-full flex justify-between items-center mb-3 py-3 px-6 bg-gray-800 rounded-full shadow-lg shadow-black h-[70px]">
      <Image
        src="/Liveduel-Logo.png"
        alt="Liveduel Logo"
        width={220}
        height={66}
        className='ml-3'
      />
      <div className="flex items-center">
        <Image
          src="/AVAX-Logo.png"
          alt="AVAX Logo"
          width={30}
          height={30}
          className='mr-2 select-none'
        />
        <span className="text-white font-bold text-xl mr-6 select-none">
          AVAX Balance: {isConnected ? balance : '0.00'}
        </span>
        {isConnected && account && (
          <span className="text-white font-bold text-sm mr-4">
            {shortenAddress(account)}
          </span>
        )}
        <button 
          className={`btn ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} border-transparent text-white hover:border-transparent px-4 py-2 rounded-full mr-[-11px]`}
          onClick={handleConnectClick}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Connect Wallet'}
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
import React from 'react';
import Image from 'next/image';
import TitleBar from '../components/Titlebar';
import MatchList from '../components/MatchList';
import Predictions from '../components/Predictions';
import '../styles/tailwind.css';

const Page = () => {
  return (
    <div className="bg-darkblue min-h-screen flex flex-col">
      <div className="flex-grow flex flex-col items-center pt-5 px-3 pb-3">
        <TitleBar />
        <div className="flex flex-col md:flex-row w-full mt-3 space-y-4 md:space-y-0 md:space-x-4 px-2 md:px-5 py-3">
          <div className="w-full md:w-2/3 bg-gray-800 rounded-xl p-3 h-[calc(50vh-8rem)] md:h-[calc(100vh-13.5rem)] overflow-auto shadow-lg shadow-black">
            <MatchList />
          </div>
          <div className="w-full md:w-1/3 bg-gray-800 rounded-xl p-3 h-[calc(50vh-8rem)] md:h-[calc(100vh-13.5rem)] shadow-lg shadow-black">
            <Predictions />
          </div>
        </div>
      </div>
      <div className="h-4 bg-gradient-to-b from-transparent to-black"></div>
      <footer className="bg-black text-white py-1 px-2">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
          <div className="flex items-center flex-wrap justify-center md:justify-start">
            <p className="mr-2 text-base font-medium select-none">Powered by</p>
            <Image
              src="/Chainlink-Logo.png"
              alt="Chainlink Logo"
              width={100}
              height={40}
              className='mt-[2px]'
            />
            <p className="mx-2 select-none hidden md:inline">|</p>
            <Image
              src="/Avalanche-Logo.png"
              alt="Avalanche Logo"
              width={100}
              height={40}
              className='mt-[2px]'
            />
          </div>
          <a href="https://github.com/portley-0/chainlink-functions-demo" target="_blank" rel="noopener noreferrer" className="flex items-center">
            <Image
              src="/Github-Icon.png"
              alt="GitHub Icon"
              width={24}
              height={24}
            />
            <Image
              src="/Github-Logo.png"
              alt="GitHub Title"
              width={80}
              height={16}
              className="ml-2 mt-[2px]"
            />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Page;
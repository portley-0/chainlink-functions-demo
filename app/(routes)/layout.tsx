import type { Metadata } from 'next'
import { MetaMaskProvider } from '../context/MetaMask'

export const metadata: Metadata = {
  title: 'Chainlink Functions Demo',
  description: 'Chainlink Functions Blockchain Sports gambling implementation',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-darkblue flex flex-col min-h-screen">
        <MetaMaskProvider>
          <main className="flex-grow">
            {children}
          </main>
        </MetaMaskProvider>
      </body>
    </html>
  );
}
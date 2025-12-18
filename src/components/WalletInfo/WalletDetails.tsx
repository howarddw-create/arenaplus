import React, { useState } from 'react'
import { WalletInfo, TokenInfo } from '../../types'
import { TransferForm } from './TransferForm'

interface WalletDetailsProps {
  wallet: WalletInfo;
  tokenInfo: TokenInfo | null;
  showPrivateKey: boolean;
  showMnemonic: boolean;
  setShowPrivateKey: (show: boolean) => void;
  setShowMnemonic: (show: boolean) => void;
  showTransferForm: boolean;
  setShowTransferForm: (show: boolean) => void;
  onTransfer: (e: React.FormEvent) => void;
  recipientAddress: string;
  setRecipientAddress: (address: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  loading: boolean;
}

export const WalletDetails: React.FC<WalletDetailsProps> = ({
  wallet,
  tokenInfo,
  showPrivateKey,
  showMnemonic,
  setShowPrivateKey,
  setShowMnemonic,
  showTransferForm,
  setShowTransferForm,
  onTransfer,
  recipientAddress,
  setRecipientAddress,
  transferAmount,
  setTransferAmount,
  loading
}) => {
  // Set up token selection - in this context we only have ARENA tokens available
  const [selectedToken, setSelectedToken] = useState<string>(tokenInfo?.symbol || '');
  
  // Create token options array with just the ARENA token
  const tokenOptions = tokenInfo ? [
    {
      symbol: tokenInfo.symbol,
      name: 'Arena Token',
      balance: tokenInfo.balance,
      address: tokenInfo.address
    }
  ] : [];
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="font-semibold text-sm text-gray-600 mb-2">Wallet Info</h2>
      <div className="space-y-2">
        <div className="break-all">
          <p className="text-xs text-gray-500">Address:</p>
          <p className="text-sm font-mono">{wallet.address}</p>
        </div>
        {tokenInfo && (
          <div className="break-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-6 h-6 mr-2 flex-shrink-0">
                  <img 
                    src="/arena.png" 
                    alt={tokenInfo.symbol} 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Token Balance:</p>
                  <p className="text-sm font-mono">
                    {tokenInfo.balance} {tokenInfo.symbol}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferForm(true)}
                className="py-1 px-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                Transfer
              </button>
            </div>
            {showTransferForm && (
              <div className="mt-4">
                <TransferForm
                  recipientAddress={recipientAddress}
                  setRecipientAddress={setRecipientAddress}
                  amount={transferAmount}
                  setAmount={setTransferAmount}
                  onSubmit={onTransfer}
                  onCancel={() => {
                    setShowTransferForm(false)
                    setRecipientAddress('')
                    setTransferAmount('')
                  }}
                  loading={loading}
                  tokenOptions={tokenOptions}
                  selectedToken={selectedToken}
                  setSelectedToken={setSelectedToken}
                />
              </div>
            )}
          </div>
        )}
        <div className="break-all">
          <p className="text-xs text-gray-500">Private Key:</p>
          <div className="relative">
            <p className="text-sm font-mono bg-gray-50 p-2 rounded">
              {showPrivateKey ? wallet.privateKey : '••••••••••••••••••'}
            </p>
            <button
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="absolute right-2 top-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {showPrivateKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {wallet.mnemonic && (
          <div className="break-all">
            <p className="text-xs text-gray-500">Recovery Phrase:</p>
            <div className="relative">
              <p className="text-sm font-mono bg-gray-50 p-2 rounded">
                {showMnemonic ? wallet.mnemonic : '••••••••••••••••••'}
              </p>
              <button
                onClick={() => setShowMnemonic(!showMnemonic)}
                className="absolute right-2 top-2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showMnemonic ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-red-500 mt-1">
          Never share your private key or recovery phrase with anyone!
        </p>
      </div>
    </div>
  )
} 
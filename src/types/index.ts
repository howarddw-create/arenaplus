import { ethers } from 'ethers'

export interface WalletInfo {
  address: string;
  privateKey: string;
  mnemonic: string;
  provider?: ethers.Provider;
}

export interface TokenInfo {
  balance: string;
  symbol: string;
  decimals: number;
  address?: string;
}

export interface TokensInfo {
  arena: TokenInfo;
  avax: TokenInfo;
}

export interface StoredWalletData {
  encryptedPrivateKey: string;
  address: string;
  hashedPassword: string;
}
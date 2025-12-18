import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';



// Interface for wallet data
export interface WalletData {
  address: string;
  encryptedPrivateKey: string;
}

// Create a new wallet
export const createWallet = async (): Promise<ethers.HDNodeWallet> => {
  const wallet = ethers.Wallet.createRandom();
  return wallet;
};

// Import wallet from private key
export const importWalletFromPrivateKey = async (privateKey: string): Promise<ethers.HDNodeWallet | ethers.Wallet> => {
  try {
    // Validate private key format
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    const wallet = new ethers.Wallet(privateKey);
    return wallet;
  } catch (error) {
    console.error('Invalid private key:', error);
    throw new Error('Invalid private key format');
  }
};

// Import wallet from mnemonic phrase
export const importWalletFromMnemonic = async (phrase: string): Promise<ethers.HDNodeWallet> => {
  try {
    const trimmed = phrase.trim();
    const wallet = ethers.Wallet.fromPhrase(trimmed);
    return wallet;
  } catch (error) {
    console.error('Invalid mnemonic phrase:', error);
    throw new Error('Invalid mnemonic phrase');
  }
};

// Encrypt wallet with password
export const encryptWallet = (wallet: ethers.HDNodeWallet | ethers.Wallet, password: string): WalletData => {
  const privateKey = wallet.privateKey;
  const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password).toString();
  
  return {
    address: wallet.address,
    encryptedPrivateKey
  };
};

// Decrypt wallet with password
export const decryptWallet = (walletData: WalletData, password: string): ethers.HDNodeWallet | ethers.Wallet => {
  try {
    const decryptedBytes = CryptoJS.AES.decrypt(walletData.encryptedPrivateKey, password);
    const privateKey = decryptedBytes.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey) {
      throw new Error('Incorrect password');
    }
    
    return new ethers.Wallet(privateKey);
  } catch (error) {
    console.error('Failed to decrypt wallet:', error);
    throw new Error('Incorrect password');
  }
};

// Save wallet to storage
export const saveWallet = async (walletData: WalletData): Promise<void> => {
  await chrome.storage.local.set({ walletData: walletData });
};

// Get wallet from storage
export const getWallet = async (): Promise<WalletData | null> => {
  const result = await chrome.storage.local.get(['walletData']);
  return result.walletData || null;
};

// Save password hash to storage
export const savePasswordHash = async (password: string): Promise<void> => {
  // Create a hash of the password, not the password itself
  const passwordHash = CryptoJS.SHA256(password).toString();
  await chrome.storage.local.set({ password: passwordHash });
};

// Verify password against stored hash
export const verifyPassword = async (password: string): Promise<boolean> => {
  const result = await chrome.storage.local.get(['password']);
  const storedHash = result.password;
  
  if (!storedHash) {
    return false;
  }
  
  const inputHash = CryptoJS.SHA256(password).toString();
  return inputHash === storedHash;
};

// Check if wallet is set up
export const isWalletSetup = async (): Promise<boolean> => {
  const result = await chrome.storage.local.get(['walletData', 'password']);
  return !!(result.walletData && result.password);
};



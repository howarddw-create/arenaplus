import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { Post2EarnGetters } from "../services/post2earn/getters";
import { ARENA_TOKEN_ADDRESS } from "../utils/arenaToken";
import { useRewardClaims } from "./useRewardClaims";

// Constants
const ARENA_TOKEN_DECIMALS = 18;

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
] as const;

export interface WalletTokenBalance {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  formattedBalance: string;
  numericBalance: number;
  tokenAddress?: string;
  isNative: boolean;
}

export interface RewardTokenMetadata {
  tokenAddress: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

const formatDisplayAmount = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }

  const abs = Math.abs(value);

  if (abs >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (abs >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  if (abs >= 0.000001) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }
  return value.toExponential(2);
};

const getTokenLabel = (tokenAddress: string) =>
  `TOKEN ${tokenAddress.slice(2, 6).toUpperCase()}`;

const normalizeTokenMetadata = (
  token: RewardTokenMetadata | any
): RewardTokenMetadata => {
  return {
    tokenAddress: token.tokenAddress,
    symbol: token.symbol ?? getTokenLabel(token.tokenAddress),
    name: token.name ?? token.symbol ?? getTokenLabel(token.tokenAddress),
    decimals: token.decimals ?? ARENA_TOKEN_DECIMALS,
  };
};

import { WalletInfo, TokenInfo } from "../types";

// ... (imports)

const useWalletTokenBalances = (
  wallet: WalletInfo | null | undefined,
  heldTokens: TokenInfo[] = []
) => {
  const walletAddress = wallet?.address;
  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Use existing hook for unclaimed rewards if available, or fetch manually
  const { rewards: unclaimedRewards } = useRewardClaims(wallet);
  const getters = new Post2EarnGetters();

  const fetchTokenMetadata = useCallback(
    async () => {
      const metadataMap = new Map<string, RewardTokenMetadata>();
      const addMetadata = (metadata: RewardTokenMetadata | null | undefined) => {
        if (!metadata?.tokenAddress) return;
        const key = metadata.tokenAddress.toLowerCase();
        if (!metadataMap.has(key)) {
          metadataMap.set(key, normalizeTokenMetadata(metadata));
        }
      };

      try {
        const subscribed = await getters.getActiveSubscribedTokens();
        subscribed.forEach((token: any) => addMetadata(token));
      } catch (err) {
        console.error("[Wallet] Failed to load subscribed tokens", err);
      }

      addMetadata({
        tokenAddress: ARENA_TOKEN_ADDRESS,
        symbol: "ARENA",
        name: "Arena Token",
        decimals: ARENA_TOKEN_DECIMALS,
      });

      const rewardTokenAddresses = new Set<string>();
      for (const reward of unclaimedRewards) {
        const rawAddress =
          reward.rewardToken || ARENA_TOKEN_ADDRESS;
        if (rawAddress) {
          rewardTokenAddresses.add(rawAddress.toLowerCase());
        }
      }

      const missingAddresses: string[] = [];
      rewardTokenAddresses.forEach((address) => {
        if (!metadataMap.has(address)) {
          missingAddresses.push(address);
        }
      });

      if (missingAddresses.length > 0) {
        await Promise.all(
          missingAddresses.map(async (address) => {
            try {
              const metadata = await getters.getRewardTokenMetadata(
                address
              );
              if (metadata) {
                addMetadata(metadata);
              }
            } catch (err) {
              console.warn(
                `[Wallet] Failed to load metadata for token ${address}`,
                err
              );
            }
          })
        );
      }

      return Array.from(metadataMap.values());
    },
    [unclaimedRewards]
  );

  const fetchBalances = useCallback(async () => {
    if (!walletAddress) {
      setBalances([]);
      setError(null);
      return;
    }

    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc");

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const metadata = await fetchTokenMetadata();

      // Fetch balances for all these tokens
      const balancePromises = metadata.map(async (token) => {
        try {
          const contract = new ethers.Contract(token.tokenAddress, ERC20_ABI, provider);
          const balance = await contract.balanceOf(walletAddress);
          const decimals = token.decimals ?? 18;
          const numeric = Number(ethers.formatUnits(balance, decimals));

          return {
            id: token.tokenAddress.toLowerCase(),
            symbol: token.symbol ?? getTokenLabel(token.tokenAddress),
            name: token.name ?? token.symbol ?? getTokenLabel(token.tokenAddress),
            decimals,
            formattedBalance: formatDisplayAmount(numeric),
            numericBalance: numeric,
            tokenAddress: token.tokenAddress,
            isNative: false,
          } as WalletTokenBalance;
        } catch (e) {
          console.warn(`Failed to fetch balance for ${token.symbol}`, e);
          return null;
        }
      });

      // Also get AVAX balance
      const avaxBalancePromise = provider.getBalance(walletAddress).then(balance => {
        const numeric = Number(ethers.formatUnits(balance, 18));
        return {
          id: "native",
          symbol: "AVAX",
          name: "Avalanche",
          decimals: 18,
          formattedBalance: formatDisplayAmount(numeric),
          numericBalance: numeric,
          isNative: true,
        } as WalletTokenBalance;
      });

      const [avaxResult, ...tokenResults] = await Promise.all([avaxBalancePromise, ...balancePromises]);

      const validTokens = tokenResults.filter((t): t is WalletTokenBalance => t !== null);

      const mergedBalances = [avaxResult, ...validTokens];

      // If we have heldTokens, let's try to map them to WalletTokenBalance and add if not present
      if (heldTokens && heldTokens.length > 0) {
        heldTokens.forEach(ht => {
          // Check if we already have this token by symbol or address (if available)
          const exists = mergedBalances.some(b => b.symbol === ht.symbol);
          if (!exists) {
            // Add it using the balance we have from heldTokens
            const numeric = parseFloat(ht.balance);
            mergedBalances.push({
              id: ht.symbol, // Use symbol as ID if no address
              symbol: ht.symbol,
              name: ht.symbol,
              decimals: 18, // Assumption
              formattedBalance: formatDisplayAmount(numeric),
              numericBalance: numeric,
              isNative: false,
            });
          }
        });
      }

      const sortedTokens = mergedBalances
        .filter((t) => t.numericBalance > 0)
        .sort((a, b) => {
          if (b.numericBalance !== a.numericBalance) {
            return b.numericBalance - a.numericBalance;
          }
          return a.symbol.localeCompare(b.symbol);
        });

      if (requestIdRef.current === currentRequestId) {
        setBalances(sortedTokens);

        // Save to storage for content script access
        const balanceMap: Record<string, string> = {};
        sortedTokens.forEach(t => {
          if (t.tokenAddress) {
            balanceMap[t.tokenAddress.toLowerCase()] = t.formattedBalance.replace(/,/g, '');
          }
        });
        chrome.storage.local.set({ arenaWalletBalances: balanceMap });
      }
    } catch (err) {
      if (requestIdRef.current === currentRequestId) {
        console.error("[Wallet] Failed to load balances:", err);
        // Fallback to heldTokens if fetch fails entirely
        if (heldTokens && heldTokens.length > 0) {
          const fallbackBalances = heldTokens.map(ht => ({
            id: ht.symbol,
            symbol: ht.symbol,
            name: ht.symbol,
            decimals: 18,
            formattedBalance: formatDisplayAmount(parseFloat(ht.balance)),
            numericBalance: parseFloat(ht.balance),
            isNative: false, // Assumption
          }));
          setBalances(fallbackBalances);
        } else {
          setBalances([]);
        }

        setError(
          err instanceof Error ? err.message : "Failed to load wallet balances"
        );
      }
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [fetchTokenMetadata, walletAddress, heldTokens]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  const refreshBalances = useCallback(async () => {
    await fetchBalances();
  }, [fetchBalances]);

  return {
    balances,
    loading,
    error,
    refresh: refreshBalances,
  };
};

export default useWalletTokenBalances;



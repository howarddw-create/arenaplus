import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ServerCrash,
} from "lucide-react";
import { formatUnits } from "ethers";

interface WalletExplorerProps {
  address: string;
}

// Unified interface for both AVAX and Token transfers
interface Transaction {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: number;
}

// Type guards for API results
interface Erc20TransferResult {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

interface NativeTxResult {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
}

const formatDisplayValue = (val: string, decimals: number) => {
  try {
    const formatted = formatUnits(val, decimals);
    // Show more precision for smaller amounts
    const maximumFractionDigits = parseFloat(formatted) < 0.0001 ? 8 : 4;
    return parseFloat(formatted).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits,
    });
  } catch (e) {
    console.error("Error formatting value:", e);
    return "0.00";
  }
};

const TransactionItem: React.FC<{
  tx: Transaction;
  currentUserAddress: string;
  refCallback?: (node: HTMLLIElement | null) => void;
}> = ({ tx, currentUserAddress, refCallback }) => {
  const isSent = tx.from.toLowerCase() === currentUserAddress.toLowerCase();

  const shortAddress = (addr: string) => {
    if (addr.toLowerCase() === currentUserAddress.toLowerCase()) {
      return "You";
    }
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <li
      ref={refCallback}
      className="py-3 px-1 border-b border-gray-100 last:border-b-0"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isSent
                ? "bg-blue-100 text-blue-600"
                : "bg-emerald-100 text-emerald-600"
              }`}
          >
            {isSent ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
          </div>
          <div>
            <p className="font-medium text-gray-800">
              {isSent ? "Sent" : "Received"}
            </p>
            <p className="text-xs text-gray-500">
              {isSent
                ? `To: ${shortAddress(tx.to)}`
                : `From: ${shortAddress(tx.from)}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={`font-semibold ${isSent ? "text-blue-600" : "text-emerald-600"
              }`}
          >
            {isSent ? "-" : "+"}
            {formatDisplayValue(tx.value, tx.tokenDecimal)} {tx.tokenSymbol}
          </p>
          <a
            href={`https://subnets.avax.network/c-chain/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-blue-600"
          >
            {tx.hash.substring(0, 8)}...
          </a>
        </div>
      </div>
    </li>
  );
};

export const WalletExplorer: React.FC<WalletExplorerProps> = ({ address }) => {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const offset = 20;

  const observer = useRef<IntersectionObserver>();
  const lastTxElementRef = useCallback(
    (node: HTMLLIElement | null) => {
      if (loadingMore || !hasMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore]
  );

  useEffect(() => {
    // Reset state when address changes
    setTxs([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setError(null);
  }, [address]);

  useEffect(() => {
    if (!address || !hasMore) return;

    const fetchTransactions = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const routescanBase = import.meta.env.VITE_ROUTESCAN_ETHERSCAN_API_URL || 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api';
        const apiBase = `${routescanBase}?address=${address}&sort=desc&page=${page}&offset=${offset}`;
        const txlistUrl = `${apiBase}&module=account&action=txlist`;
        const tokentxUrl = `${apiBase}&module=account&action=tokentx`;

        const [nativeRes, tokenRes] = await Promise.all([
          fetch(txlistUrl),
          fetch(tokentxUrl),
        ]);

        if (!nativeRes.ok || !tokenRes.ok) {
          throw new Error("Failed to fetch data from block explorer");
        }

        const nativeJson = await nativeRes.json();
        const tokenJson = await tokenRes.json();

        const nativeTxs: NativeTxResult[] = Array.isArray(nativeJson.result)
          ? nativeJson.result.filter(
            (tx: NativeTxResult) => parseFloat(tx.value) > 0
          ) // Filter out contract calls with no AVAX value
          : [];

        const tokenTxs: Erc20TransferResult[] = Array.isArray(tokenJson.result)
          ? tokenJson.result
          : [];

        const mappedNative: Transaction[] = nativeTxs.map((tx) => ({
          ...tx,
          tokenSymbol: "AVAX",
          tokenDecimal: 18,
        }));

        const mappedTokens: Transaction[] = tokenTxs.map((tx) => ({
          ...tx,
          tokenDecimal: parseInt(tx.tokenDecimal, 10),
        }));

        const combined = [...mappedNative, ...mappedTokens].sort(
          (a, b) => parseInt(b.timeStamp, 10) - parseInt(a.timeStamp, 10)
        );

        if (combined.length === 0 && page > 1) {
          setHasMore(false);
        } else {
          setTxs((prev) => (page === 1 ? combined : [...prev, ...combined]));
          if (combined.length < offset) {
            // Heuristic to stop fetching
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error("Explorer fetch error", err);
        setError("Failed to fetch transactions. Please try again later.");
        setHasMore(false);
      } finally {
        if (page === 1) setLoading(false);
        else setLoadingMore(false);
      }
    };

    fetchTransactions();
  }, [address, page, hasMore]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
          <Loader2 className="animate-spin h-8 w-8 mb-2" />
          <p>Loading Transactions...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-red-500">
          <ServerCrash className="h-8 w-8 mb-2" />
          <p className="text-center">{error}</p>
        </div>
      );
    }

    if (txs.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">No transactions found.</p>
      );
    }

    return (
      <ul className="space-y-1 max-h-80 overflow-y-auto px-3">
        {txs.map((tx, index) => (
          <TransactionItem
            key={`${tx.hash}-${index}`}
            tx={tx}
            currentUserAddress={address}
            refCallback={
              txs.length === index + 1 ? lastTxElementRef : undefined
            }
          />
        ))}
        {loadingMore && (
          <div className="flex items-center justify-center py-4 text-gray-500">
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
            <span>Loading more...</span>
          </div>
        )}
      </ul>
    );
  };

  return (
    <div className="mt-4">{renderContent()}</div>
  );
};

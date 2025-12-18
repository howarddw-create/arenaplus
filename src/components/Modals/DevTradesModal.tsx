import React, { useState } from "react";
import { Modal } from "../WalletInfo/Modal";
import { CloseButton } from "../UI/CloseButton";
import { formatTokenAmount } from "../../utils/formatters";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TradeItem {
  create_time: number; // unix timestamp in seconds
  user_eth: number; // negative for buy, positive for sell
  token_eth: string; // raw amount in wei (as string)
  price_eth: string; // price per token in wei (string)
  user_usd: number; // usd value of user leg (signed)
}

interface TokenTrades {
  contractAddress: string;
  alias?: string;
  name?: string;
  symbol?: string;
  liveTrades?: TradeItem[];
  presaleTrades?: TradeItem[];
}

interface DevTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: TokenTrades | null;
}

export const DevTradesModal: React.FC<DevTradesModalProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [view, setView] = useState<"live" | "presale">("live");

  if (!isOpen || !token) return null;

  const trades = view === "presale" ? token.presaleTrades : token.liveTrades;

  const formatTimeAgo = (dateInput: string | number | Date): string => {
    const date =
      typeof dateInput === "string" ? new Date(parseInt(dateInput)) : dateInput;
    const diffSeconds = Math.floor(
      (Date.now() - new Date(date).getTime()) / 1000
    );
    const units: [number, string][] = [
      [31536000, "y"],
      [2592000, "mo"],
      [86400, "d"],
      [3600, "h"],
      [60, "m"],
    ];
    for (const [secs, label] of units) {
      const v = Math.floor(diffSeconds / secs);
      if (v >= 1) {
        return `${v}${label} ago`;
      }
    }
    return "just now";
  };

  const summary = trades?.reduce(
    (acc, trade) => {
      const isBuy = trade.user_eth < 0;
      const tokenAmount = Math.abs(parseFloat(trade.token_eth));

      if (isBuy) {
        acc.tokensBought += tokenAmount;
        acc.avaxSpent += Math.abs(trade.user_eth);
        acc.usdSpent += Math.abs(trade.user_usd);
      } else {
        acc.tokensSold += tokenAmount;
        acc.avaxReceived += Math.abs(trade.user_eth);
        acc.usdReceived += Math.abs(trade.user_usd);
      }
      return acc;
    },
    {
      tokensBought: 0,
      tokensSold: 0,
      avaxSpent: 0,
      avaxReceived: 0,
      usdSpent: 0,
      usdReceived: 0,
    }
  );

  const fmt = (v?: number, dec: number = 2, compact: boolean = false) => {
    if (v === undefined || v === null) return "-";
    const options: Intl.NumberFormatOptions = {
      maximumFractionDigits: dec,
    };
    if (compact) {
      options.notation = "compact";
    }
    return v.toLocaleString(undefined, options);
  };

  const tokenName =
    token.alias || token.name || token.symbol || token.contractAddress;

  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen>
      <div className="flex h-full w-full flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Dev Trades</h2>
            <p className="text-xs text-slate-500 break-all">{tokenName}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-[92%] py-5">
            {/* Toggle */}
            <div className="flex items-center gap-2">
              {(["live", "presale"] as const).map((key) => (
                <button
                  key={key}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                    view === key
                      ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg"
                      : "border border-white/60 bg-white/60 text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setView(key)}
                >
                  {key === "live" ? "Live" : "Presale"}
                </button>
              ))}
            </div>

            {/* Trades Table */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/60 bg-white/80 shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blue-50/40 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Price (AVAX)</th>
                    <th className="p-3 text-right">Value (USD)</th>
                  </tr>
                </thead>
                {trades && trades.length > 0 ? (
                  <tbody>
                    {trades.map((trade, idx) => {
                      const isBuy = trade.user_eth < 0;
                      const usdValue = Math.abs(trade.user_usd);
                      return (
                        <tr
                          key={idx}
                          className="border-t border-slate-100/80 hover:bg-slate-50"
                        >
                          <td className="p-3 whitespace-nowrap text-slate-500">
                            {formatTimeAgo(trade.create_time * 1000)}
                          </td>
                          <td
                            className={`p-3 whitespace-nowrap font-semibold ${
                              isBuy ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isBuy ? (
                                <ArrowUpRight className="h-5 w-5" />
                              ) : (
                                <ArrowDownRight className="h-5 w-5" />
                              )}
                              {isBuy ? "Buy" : "Sell"}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap text-right font-mono">
                            {formatTokenAmount(
                              Math.abs(parseFloat(trade.token_eth)),
                              4,
                              false
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-right font-mono text-slate-500">
                            {formatTokenAmount(trade.price_eth, 6, false)}
                          </td>
                          <td className="p-3 whitespace-nowrap text-right font-mono">
                            ${usdValue.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ) : (
                  <tbody />
                )}
              </table>
              {(!trades || trades.length === 0) && (
                <p className="py-8 text-center text-slate-500">No {view} trades found.</p>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <div className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-white/60 bg-gradient-to-r from-white via-blue-50/80 to-white p-4">
                  <h3 className="mb-2 font-semibold text-slate-800">Summary (Buy)</h3>
                  <div className="space-y-1 text-slate-600">
                    <p className="flex justify-between">
                      Tokens Bought:
                      <span className="font-semibold text-emerald-700">
                        {fmt(summary.tokensBought, 2, true)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      AVAX Spent:
                      <span className="font-semibold text-emerald-700">
                        {fmt(summary.avaxSpent, 4)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      USD Spent:
                      <span className="font-semibold text-emerald-700">
                        ${fmt(summary.usdSpent, 2)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/60 bg-gradient-to-r from-white via-blue-50/80 to-white p-4">
                  <h3 className="mb-2 font-semibold text-slate-800">Summary (Sell)</h3>
                  <div className="space-y-1 text-slate-600">
                    <p className="flex justify-between">
                      Tokens Sold:
                      <span className="font-semibold text-rose-700">
                        {fmt(summary.tokensSold, 2, true)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      AVAX Received:
                      <span className="font-semibold text-rose-700">
                        {fmt(summary.avaxReceived, 4)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      USD Received:
                      <span className="font-semibold text-rose-700">
                        ${fmt(summary.usdReceived, 2)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

import React, { useState } from "react";
import { ethers } from "ethers";
import { TokenInfo } from "../../types";
import { AVALANCHE_RPC } from "../../constants";
import { formatTokenBalance, formatTokenAmount } from "../../utils/formatters";
import { Spinner } from "../UI/Spinner";
import { SearchIcon } from "../UI/SearchIcon";
import { DevTradesModal } from "../Modals/DevTradesModal";
import { getBearerToken } from "../../services/post2earnService";

interface TokenStats {
  contractAddress: string;
  alias?: string;
  name?: string;
  symbol?: string;
  supply?: number;
  holders?: number;
  keyPrice?: number; // original key price from shares
  price?: number; // latest price from stats
  liquidity?: number;
  marketCap?: number;
  buys?: number;
  sells?: number;
  devTokensBought?: number;
  devTokensSold?: number;
  devUsdSpent?: number;
  devUsdReceived?: number;
  photoURL?: string; // added token/community photo
  presaleTrades?: any[];
  liveTrades?: any[];
  heldBalance?: number; // wallet balance
  createdOn?: string; // community creation date
}

interface DeepDiveResult {
  // Profile
  daysOld?: number;
  badgesOwned?: number;
  arenaPosts?: number;
  arenaFollowers?: number;
  arenaFollowing?: number;
  arenaLink?: string;
  arenaBookLink?: string;
  twitterLink?: string;
  twitterFollowers?: number;

  // Financials
  totalGladiatorTickets?: number;
  totalGladiatorHolders?: number;
  ticketPrice?: number;
  ticketsHeld?: number;
  portfolioValue?: number;
  referralEarnings?: number;
  feesEarned?: number;
  feesPaid?: number;

  // Tokens
  tokens?: TokenStats[];
}

interface DeepDiveTabProps {
  heldTokens?: TokenInfo[];
  walletAddress?: string | null;
}

export const DeepDiveTab: React.FC<DeepDiveTabProps> = ({
  heldTokens = [],
  walletAddress,
}) => {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<DeepDiveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeModalToken, setTradeModalToken] = useState<TokenStats | null>(
    null
  );

  const formatTimeAgo = (dateInput: string | number | Date): string => {
    const date = new Date(dateInput);
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const units: [number, string][] = [
      [365 * 24 * 60 * 60, "year"],
      [30 * 24 * 60 * 60, "month"],
      [24 * 60 * 60, "day"],
      [60 * 60, "hour"],
      [60, "minute"],
      [1, "second"],
    ];
    for (const [secs, label] of units) {
      const v = Math.floor(diffSeconds / secs);
      if (v >= 1) {
        return `${v} ${label}${v > 1 ? "s" : ""} ago`;
      }
    }
    return "just now";
  };

  const fetchDeepDive = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const bearer = await getBearerToken();
      const authHeader = { Authorization: `Bearer ${bearer}` } as const;
      const userRes = await fetch(
        `https://api.starsarena.com/user/handle?handle=${encodeURIComponent(
          username.trim()
        )}`,
        { headers: authHeader }
      );
      const userData = await userRes.json();
      if (!userRes.ok || !userData.user) {
        throw new Error("User not found");
      }
      const user = userData.user;
      const userId = user.id as string;
      const daysOld = user.createdOn
        ? Math.floor(
          (Date.now() - new Date(user.createdOn).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        : undefined;

      const base: DeepDiveResult = {
        daysOld,
        arenaPosts: user.threadCount,
        arenaFollowers: user.followerCount,
        arenaFollowing: user.followingsCount,
        arenaLink: `https://arena.social/${username.trim()}`,
        arenaBookLink: `https://arena.trade/user/${user.address}`,
        twitterLink: `https://twitter.com/${user.twitterHandle}`,
        twitterFollowers: user.twitterFollowers,
      };

      try {
        const upsRes = await fetch(
          `https://api.starsarena.com/uprising/user-info?id=${userId}`,
          { headers: authHeader }
        );
        if (upsRes.ok) {
          const upsData = await upsRes.json();
          if (Array.isArray(upsData.ownedBadges)) {
            base.badgesOwned = upsData.ownedBadges.length;
          }
        }
      } catch (e) {
        console.error("uprising fetch error", e);
      }

      try {
        const shareRes = await fetch(
          `https://api.starsarena.com/shares/stats?userId=${userId}`,
          { headers: authHeader }
        );
        if (shareRes.ok) {
          const shareData = await shareRes.json();
          const parseAndFormat = (val: string) =>
            val ? parseFloat(val) / 1e18 : undefined;

          base.totalGladiatorTickets = shareData.stats.supply;
          base.totalGladiatorHolders = shareData.totalHolders
            ? parseInt(shareData.totalHolders, 10)
            : undefined;
          base.ticketsHeld = shareData.totalHoldings
            ? parseInt(shareData.totalHoldings, 10)
            : undefined;
          base.portfolioValue = parseAndFormat(shareData.portfolioValue);

          if (shareData.stats) {
            base.ticketPrice = parseAndFormat(shareData.stats.keyPrice);
            base.referralEarnings = parseAndFormat(
              shareData.stats.referralsEarned
            );
            base.feesEarned = parseAndFormat(shareData.stats.feesEarned);
            base.feesPaid = parseAndFormat(shareData.stats.feesPaid);
          }
        }
      } catch (e) {
        console.error("shares stats fetch error", e);
      }

      // -------- Token Deep Dive --------
      try {
        // 1. Fetch user EVM transactions and filter createToken calls
        const txListUrl = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=account&action=txlist&address=${user.address}&sort=desc&page=1&offset=10000`;
        const txRes = await fetch(txListUrl, { headers: authHeader });
        if (txRes.ok) {
          const txJson = await txRes.json();
          const txList: any[] = Array.isArray(txJson.result)
            ? txJson.result
            : [];
          const createTokenTxs = txList.filter((t) =>
            (t.functionName || "").toLowerCase().startsWith("createtoken")
          );

          const tokens: TokenStats[] = [];

          for (const tx of createTokenTxs) {
            const txHash: string = tx.hash || tx.transactionHash;
            if (!txHash) continue;

            // 2. Get transaction receipt to extract token contract address
            const receiptUrl = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}`;
            const receiptRes = await fetch(receiptUrl, { headers: authHeader });
            if (!receiptRes.ok) continue;
            const receiptJson = await receiptRes.json();
            const receipt = receiptJson.result;
            if (
              !receipt ||
              !Array.isArray(receipt.logs) ||
              !receipt.logs.length
            )
              continue;

            const rawAddress: string = receipt.logs[0].address;
            if (!rawAddress || !ethers.isAddress(rawAddress)) continue;
            const tokenAddress: string = ethers.getAddress(rawAddress);
            if (!tokenAddress) continue;

            // 4. Fetch presale trades from background script
            const presaleTrades = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: "FETCH_PRESALE_TRADES",
                  payload: {
                    userAddress: user.address,
                    tokenAddress,
                  },
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error fetching presale trades:",
                      chrome.runtime.lastError.message
                    );
                    resolve(undefined);
                  } else if (response && response.success) {
                    resolve(response.data);
                  } else {
                    console.error(
                      "Failed to fetch presale trades:",
                      response?.error
                    );
                    resolve(undefined);
                  }
                }
              );
            });

            // 5. Fetch live trades from background script
            const liveTrades = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: "FETCH_DEV_TRADES",
                  payload: {
                    userAddress: user.address,
                    tokenAddress,
                  },
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error fetching live trades:",
                      chrome.runtime.lastError.message
                    );
                    resolve(undefined);
                  } else if (response && response.success) {
                    resolve(response.data);
                  } else {
                    console.error(
                      "Failed to fetch live trades:",
                      response?.error
                    );
                    resolve(undefined);
                  }
                }
              );
            });

            // 3. Fetch StarsArena group stats for token
            const groupUrl = `https://api.starsarena.com/communities/group-stats?contractAddress=${tokenAddress}`;
            const groupRes = await fetch(groupUrl, { headers: authHeader });
            if (!groupRes.ok) {
              console.warn(
                "[DeepDive] group-stats call failed",
                groupUrl,
                groupRes.status
              );
              continue;
            }
            const groupData = await groupRes.json();

            // Debug: raw group data
            console.log("[DeepDive] Raw groupData", tokenAddress, groupData);

            const toAvax = (val: string | number | undefined) => {
              if (val === undefined || val === null) return undefined;
              const n = typeof val === "string" ? parseFloat(val) : val;
              return n / 1e18;
            };

            // Fetch Routescan detail for alias/symbol if missing
            let alias: string | undefined;
            let symbol: string | undefined =
              groupData.symbol ?? groupData.tokenSymbol;
            try {
              const detailUrl = `https://cdn.routescan.io/api/blockchain/all/address/${tokenAddress}?ecosystem=avalanche`;
              const detailRes = await fetch(detailUrl);
              if (detailRes.ok) {
                const detailJson = await detailRes.json();
                alias = detailJson.detail?.alias;
                if (!symbol) {
                  symbol = detailJson.detail?.symbol;
                }
              }
            } catch (err) {
              console.error("routescan alias fetch error", err);
            }

            const stats = groupData.stats ?? {};

            const tokenObj: TokenStats = {
              contractAddress: tokenAddress,
              presaleTrades: presaleTrades as any[],
              liveTrades: liveTrades as any[],
              alias,
              name: groupData.name ?? groupData.tokenName,
              symbol,
              // Determine supply (convert string/int raw 1e18 values to readable number if needed)
              supply: (() => {
                const raw =
                  groupData.supply ??
                  stats.totalSupply ??
                  groupData.stats?.supply;
                if (raw === undefined || raw === null) return undefined;
                const num = typeof raw === "string" ? parseFloat(raw) : raw;
                // Heuristic: if very large (likely raw with 18 decimals), scale down
                return num > 1e9 ? num / 1e18 : num;
              })(),
              // Extract holders from multiple possible fields, default to 0
              holders:
                groupData.totalHolders ??
                groupData.holderCount ??
                groupData.holders ??
                stats.totalHolders ??
                stats.holders ??
                stats.holderCount ??
                0,
              keyPrice: toAvax(groupData.keyPrice ?? stats.keyPrice),
              price: toAvax(stats.price),
              liquidity: toAvax(stats.liquidity),
              marketCap: toAvax(stats.marketCap),
              buys: stats.buys,
              sells: stats.sells,
            } as TokenStats;

            // -------- Fetch community photo & precise holders --------
            try {
              const communityId =
                groupData.communityId ?? stats.communityId ?? stats.id;
              if (communityId) {
                // 3a. Community profile for photo
                const profileUrl = `https://api.starsarena.com/communities/get-community-profile?communityId=${communityId}`;
                const profRes = await fetch(profileUrl, { headers: authHeader });
                if (profRes.ok) {
                  const profJson = await profRes.json();
                  tokenObj.photoURL =
                    profJson?.community?.photoURL ?? undefined;
                  tokenObj.createdOn =
                    profJson?.community?.createdOn ?? undefined;
                }
              }
            } catch (err) {
              console.error("community profile fetch error", err);
            }

            try {
              // 3b. Up-to-date holder count (cheaper pageSize=1)
              const holdersUrl = `https://api.starsarena.com/communities/holders?page=1&pageSize=1&contractAddress=${tokenAddress}`;
              const holdRes = await fetch(holdersUrl, { headers: authHeader });
              if (holdRes.ok) {
                const holdJson = await holdRes.json();
                if (
                  holdJson &&
                  (holdJson.numberOfResults || holdJson.numberOfResults === 0)
                ) {
                  tokenObj.holders = holdJson.numberOfResults;
                }
              }
            } catch (err) {
              console.error("holders fetch error", err);
            }

            // 3c. Developer-specific trade summary
            try {
              const response = await chrome.runtime.sendMessage({
                type: "FETCH_DEV_TRADES",
                payload: {
                  tokenAddress: tokenAddress,
                  userAddress: user.address,
                  // devAuthToken: devAuthToken,
                },
              });

              if (response && response.success) {
                const trades = Array.isArray(response.data)
                  ? response.data
                  : response.data.data;
                if (Array.isArray(trades)) {
                  let tokensBought = 0;
                  let tokensSold = 0;
                  let usdSpent = 0;
                  let usdReceived = 0;

                  for (const t of trades) {
                    const tokenEthRaw = t?.token_eth ?? 0;
                    const tokenEthNum =
                      typeof tokenEthRaw === "string"
                        ? parseFloat(tokenEthRaw)
                        : tokenEthRaw;
                    const usdRaw = t?.user_usd ?? 0;
                    const usdNum =
                      typeof usdRaw === "string" ? parseFloat(usdRaw) : usdRaw;

                    if (tokenEthNum > 0) {
                      // Buy
                      tokensBought += tokenEthNum;
                      usdSpent += Math.abs(usdNum);
                    } else if (tokenEthNum < 0) {
                      // Sell
                      tokensSold += Math.abs(tokenEthNum);
                      usdReceived += Math.abs(usdNum);
                    }
                  }

                  tokenObj.devTokensBought = tokensBought;
                  tokenObj.devTokensSold = tokensSold;
                  tokenObj.devUsdSpent = usdSpent;
                  tokenObj.devUsdReceived = usdReceived;
                }
              } else {
                console.error(
                  "Failed to fetch dev trades from background:",
                  response?.error
                );
              }
            } catch (err) {
              console.error("Error sending message to background script:", err);
            }

            tokens.push(tokenObj);
          }

          if (tokens.length) {
            console.log("[DeepDive] Final tokens array", tokens);
            // Optionally fetch wallet balances for tokens if walletAddress provided
            if (walletAddress) {
              const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
              const balABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function decimals() view returns (uint8)",
              ];
              await Promise.all(
                tokens.map(async (tk) => {
                  try {
                    if (!ethers.isAddress(tk.contractAddress)) return;
                    const contract = new ethers.Contract(
                      tk.contractAddress,
                      balABI,
                      provider
                    );
                    const [rawBal, decimals] = await Promise.all([
                      contract.balanceOf(walletAddress),
                      contract.decimals(),
                    ]);
                    const bal = parseFloat(
                      ethers.formatUnits(rawBal, decimals)
                    );
                    if (bal > 0) {
                      tk.heldBalance = bal;
                    }
                  } catch (e) {
                    console.warn("balance fetch failed", tk.contractAddress);
                  }
                })
              );
              console.log("[DeepDive] Successfully fetched wallet balances");
            }

            // Final per-token debug with wallet balance
            tokens.forEach((tk) => {
              console.log("[DeepDive] Final token", {
                address: tk.contractAddress,
                held: tk.heldBalance ?? "0",
              });
            });

            base.tokens = tokens;
          }
        }
      } catch (e) {
        console.error("token deep dive fetch error", e);
      }

      setResult(base);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (label: string, value: any, unit: string = "") => {
    const displayValue =
      value !== null && value !== undefined ? `${value} ${unit}`.trim() : "-";
    return (
      <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-800">{displayValue}</span>
      </div>
    );
  };

  const renderLink = (href: string | undefined, text: string) =>
    href ? (
      <a
        href={href}
        className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
        target="_blank"
        rel="noreferrer"
      >
        {text}
      </a>
    ) : (
      <span className="text-slate-400">-</span>
    );

  return (
    <div className="space-y-5 pb-4">
      <div className="card-section p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title text-[0.65rem]">Analysis</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-800">Deep Dive</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-stretch rounded-xl border border-white/60 bg-white/80 shadow-sm">
              <div className="relative flex-1">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchDeepDive()}
                  className="w-full bg-transparent px-10 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Enter Arena username..."
                />
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-300">
                  <SearchIcon className="h-5 w-5" />
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-300">
                  @
                </span>
              </div>
              <button
                onClick={fetchDeepDive}
                disabled={loading}
                className="gradient-button inline-flex h-full shrink-0 items-center justify-center rounded-r-xl px-4 py-3 text-white disabled:cursor-not-allowed"
                aria-busy={loading}
                title="Search"
              >
                {loading ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <SearchIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="card-section p-5 text-center text-sm text-slate-500">
            Gathering metrics for {username || "profile"}...
          </div>
        )}
        {error && (() => {
          const msg = String(error || "");
          const needsSync = /sync your arena profile/i.test(msg) || /bearer token/i.test(msg);
          if (needsSync) {
            return (
              <div className="card-section p-5">
                <p className="text-sm text-slate-600">
                  Sync your Arena profile to interact with this feature. Open Arena Social, browse for a moment, then return here.
                </p>
                <a
                  href="https://arena.social/home"
                  target="_blank"
                  rel="noreferrer"
                  className="gradient-button mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
                >
                  Open Arena Social
                </a>
              </div>
            );
          }
          return (
            <div className="card-section border border-rose-200/70 bg-rose-50/70 p-5 text-sm text-rose-600">
              {error}
            </div>
          );
        })()}

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Profile Card */}
              <div className="card-section md:col-span-1 p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  Profile
                </h2>
                {renderField("Arena Followers", result.arenaFollowers)}
                {renderField("Arena Following", result.arenaFollowing)}
                {renderField("Twitter Followers", result.twitterFollowers)}
                {renderField("Arena Posts", result.arenaPosts)}
                {renderField("Badges Owned", result.badgesOwned)}
                {renderField("Days Old", result.daysOld)}
              </div>

              {/* Financials Card */}
              <div className="card-section md:col-span-2 p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  Financials
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderField(
                    "Portfolio Value",
                    result.portfolioValue?.toFixed(4),
                    "AVAX"
                  )}
                  {renderField(
                    "Ticket Price",
                    result.ticketPrice?.toFixed(4),
                    "AVAX"
                  )}
                  {renderField("Total Tickets", result.totalGladiatorTickets)}
                  {renderField("Tickets Held", result.ticketsHeld)}
                  {renderField("Total Holders", result.totalGladiatorHolders)}
                  {renderField(
                    "Fees Earned",
                    result.feesEarned?.toFixed(4),
                    "AVAX"
                  )}
                  {renderField(
                    "Fees Paid",
                    result.feesPaid?.toFixed(4),
                    "AVAX"
                  )}
                  {renderField(
                    "Referral Earnings",
                    result.referralEarnings?.toFixed(4),
                    "AVAX"
                  )}
                </div>
              </div>
            </div>

            {/* Links Card */}
            <div className="card-section p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-800">
                Links
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {renderLink(result.arenaLink, "Arena Profile")}
                {renderLink(result.arenaBookLink, "Arena.trade")}
                {renderLink(result.twitterLink, "Twitter")}
              </div>
            </div>

            {/* Tokens Card */}
            <div className="card-section p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-800">
                Tokens Created
              </h2>
              {result.tokens && result.tokens.length > 0 ? (
                <div className="divide-y divide-slate-100/70">
                  {result.tokens.map((token) => {
                    const displayName =
                      token.alias ||
                      token.name ||
                      token.symbol ||
                      token.contractAddress.slice(0, 6) + "...";

                    // Enhanced formatter: supports compact notation (e.g., 1M, 1B) and optional default "0" fallback
                    const fmt = (
                      v?: number,
                      dec: number = 2,
                      compact: boolean = false,
                      defaultZero: boolean = false
                    ) =>
                      v !== undefined && v !== null
                        ? compact
                          ? new Intl.NumberFormat(undefined, {
                            notation: "compact",
                            maximumFractionDigits: dec,
                          }).format(v)
                          : v.toLocaleString(undefined, {
                            maximumFractionDigits: dec,
                          })
                        : defaultZero
                          ? "0"
                          : "-";

                    const toSub = (num: number) => {
                      const map: Record<string, string> = {
                        "0": "₀",
                        "1": "₁",
                        "2": "₂",
                        "3": "₃",
                        "4": "₄",
                        "5": "₅",
                        "6": "₆",
                        "7": "₇",
                        "8": "₈",
                        "9": "₉",
                      };
                      return num
                        .toString()
                        .split("")
                        .map((d) => map[d] || "")
                        .join("");
                    };

                    const fmtPrice = (v?: number) => {
                      if (v === undefined || v === null) return "-";

                      // For reasonably sized numbers, show up to 6 decimals
                      if (v >= 0.01) {
                        return v.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        });
                      }

                      // Format tiny numbers using subscript zero-count style
                      const full = v.toFixed(18); // ensures long decimal representation
                      const fraction = full.split(".")[1] || "";
                      const leadingZeros =
                        fraction.match(/^0+/)?.[0].length || 0;

                      // If not many leading zeros, fall back
                      if (leadingZeros <= 1) {
                        return v.toLocaleString(undefined, {
                          maximumFractionDigits: 8,
                        });
                      }

                      const significant = fraction
                        .slice(leadingZeros)
                        .slice(0, 4); // first 4 significant digits
                      const sub = toSub(leadingZeros - 1); // subtract the one explicit zero we'll keep

                      return `0.0${sub}${significant}`;
                    };

                    return (
                      <div key={token.contractAddress} className="py-4">
                        <div className="flex items-start gap-4">
                          {token.photoURL && (
                            <img
                              src={token.photoURL}
                              alt={displayName}
                              className="h-12 w-12 flex-shrink-0 rounded-full object-cover shadow"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <a
                                href={`https://subnets.avax.network/c-chain/address/${token.contractAddress}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                              >
                                {displayName}
                              </a>
                              {token.createdOn && (
                                <>
                                  <span className="text-xs text-slate-400">
                                    {formatTimeAgo(token.createdOn)}
                                  </span>
                                </>
                              )}
                            </div>
                            {token.symbol && (
                              <p className="mt-0.5 text-xs uppercase tracking-[0.3em] text-slate-400">
                                {token.symbol}
                              </p>
                            )}
                            {(() => {
                              const held = heldTokens.find(
                                (ht) =>
                                  ht.address &&
                                  token.contractAddress &&
                                  ht.address.toLowerCase() ===
                                  token.contractAddress.toLowerCase() &&
                                  parseFloat(ht.balance) > 0
                              );

                              const balanceStr = held
                                ? formatTokenBalance(held.balance, held.symbol)
                                : token.heldBalance !== undefined
                                  ? formatTokenAmount(token.heldBalance)
                                  : null;
                              return balanceStr ? (
                                <p className="mt-1 text-xs text-emerald-500">
                                  You hold: {balanceStr}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          {/* Left Column */}
                          <div className="space-y-2">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {fmt(token.holders, 0, false, true)}
                              </span>
                              <span className="ml-1.5 text-slate-400">
                                Holders
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">
                                {fmtPrice(token.price)}
                              </span>
                              <span className="ml-1.5 text-slate-400">
                                Price (AVAX)
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">
                                {fmt(token.marketCap)}
                              </span>
                              <span className="ml-1.5 text-slate-400">
                                MC (AVAX)
                              </span>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-2 text-right">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {fmt(token.supply, 2, true)}
                              </span>
                              <span className="ml-1.5 text-slate-400">
                                Supply
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">
                                {fmt(token.liquidity)}
                              </span>
                              <span className="ml-1.5 text-slate-400">
                                Liquidity
                              </span>
                            </div>
                          </div>

                          {/* Buys/Sells - Spanning full width below the two columns */}
                          <div className="col-span-2 mt-2">
                            <span className="font-semibold text-slate-800">
                              {token.buys ?? 0}
                            </span>
                            <span className="ml-1 text-emerald-500">buys</span>
                            <span className="mx-1.5 text-slate-300">/</span>
                            <span className="font-semibold text-slate-800">
                              {token.sells ?? 0}
                            </span>
                            <span className="ml-1 text-rose-500">sells</span>
                          </div>

                          {/* Dev Trades Button */}
                          {((token.liveTrades && token.liveTrades.length > 0) ||
                            (token.presaleTrades &&
                              token.presaleTrades.length > 0)) && (
                              <div className="col-span-2 mt-2">
                                <button
                                  onClick={() => setTradeModalToken(token)}
                                  className="gradient-button rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow"
                                >
                                  View Dev Trades
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                  No tokens found for this user.
                </p>
              )}
            </div>
          </div>
        )}
        {/* Dev Trades Modal */}
        {tradeModalToken && (
          <DevTradesModal
            isOpen={!!tradeModalToken}
            token={tradeModalToken}
            onClose={() => setTradeModalToken(null)}
          />
        )}
    </div>
  );
};

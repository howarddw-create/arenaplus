import { useState, useEffect, useRef, useMemo } from "react";
import { RefreshCcw, Users, Trophy, Loader2 } from "lucide-react";
import leaderboardService, {
  type LeaderboardEntry,
} from "../../services/leaderboardService";
import threadService from "../../services/threadService";
import { useWallet } from "../../hooks/useWallet";

const shortenAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatScore = (score: number): string => {
  return score.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const leaderboardLabels = {
  users: "Earners",
  promoters: "Spenders",
} as const;

const LeaderboardTab = () => {
  const { wallet } = useWallet();
  const walletAddress = wallet?.address;
  const [activeLeaderboard, setActiveLeaderboard] =
    useState<"users" | "promoters">("users");
  const [userLeaderboard, setUserLeaderboard] = useState<LeaderboardEntry[]>(
    []
  );
  const [promoterLeaderboard, setPromoterLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [userCount, setUserCount] = useState(15);
  const [promoterCount, setPromoterCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const enrichEntries = async (entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> => {
    return Promise.all(
      entries.map(async (entry) => {
        if (!entry.arenaUserId) return entry;

        try {
          const threads = await threadService.fetchRecentThreadsByUserId(
            entry.arenaUserId,
            1,
            1
          );
          const thread = threads[0];

          if (thread?.user) {
            return {
              ...entry,
              username: thread.user.userHandle || thread.user.handle,
              pfp_url: thread.user.userPicture || thread.user.profilePicture,
            };
          }
        } catch (error) {
          console.error(`Failed to fetch profile for ${entry.arenaUserId}:`, error);
        }

        return entry;
      })
    );
  };

  const fetchLeaderboards = async () => {
    setLoading(true);
    setError(null);
    setUserCount(15);
    setPromoterCount(15);

    try {
      const [usersRaw, promotersRaw] = await Promise.all([
        leaderboardService.getUserLeaderboardRaw(),
        leaderboardService.getPromoterLeaderboardRaw(),
      ]);

      const users = usersRaw.filter((entry) => entry.new_score > 0);
      const promoters = promotersRaw.filter((entry) => entry.new_score > 0);

      // Set initial data immediately
      setUserLeaderboard(users);
      setPromoterLeaderboard(promoters);

      // Enrich in background
      enrichEntries(users).then(enrichedUsers => {
        setUserLeaderboard(() => {
          return enrichedUsers;
        });
      });

      enrichEntries(promoters).then(enrichedPromoters => {
        setPromoterLeaderboard(enrichedPromoters);
      });

    } catch (err) {
      console.error("Error fetching leaderboards:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  const visibleUsers = userLeaderboard.slice(0, userCount);
  const visiblePromoters = promoterLeaderboard.slice(0, promoterCount);
  const filteredLeaderboard =
    activeLeaderboard === "users" ? visibleUsers : visiblePromoters;

  const canLoadMore =
    activeLeaderboard === "users"
      ? userCount < userLeaderboard.length
      : promoterCount < promoterLeaderboard.length;

  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  const myUserRankIndex = useMemo(() => {
    if (!normalizedWalletAddress) return -1;
    return userLeaderboard.findIndex(
      (entry) => entry.address.toLowerCase() === normalizedWalletAddress
    );
  }, [normalizedWalletAddress, userLeaderboard]);

  const myPromoterRankIndex = useMemo(() => {
    if (!normalizedWalletAddress) return -1;
    return promoterLeaderboard.findIndex(
      (entry) => entry.address.toLowerCase() === normalizedWalletAddress
    );
  }, [normalizedWalletAddress, promoterLeaderboard]);

  const activeLeaderboardFull = activeLeaderboard === "users" ? userLeaderboard : promoterLeaderboard;
  const activeMyRankIndex = activeLeaderboard === "users" ? myUserRankIndex : myPromoterRankIndex;
  const myRankEntry = activeMyRankIndex >= 0 ? activeLeaderboardFull[activeMyRankIndex] : undefined;
  const showMyRank = Boolean(walletAddress && myRankEntry && activeMyRankIndex < 50);
  const myRankPosition = activeMyRankIndex + 1;

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !canLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loadingMore) {
          void handleLoadMore();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [canLoadMore, loadingMore, activeLeaderboard, userCount, promoterCount]);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      if (activeLeaderboard === "users") {
        const start = userCount;
        const count = Math.min(
          15,
          Math.max(0, userLeaderboard.length - start)
        );
        if (count > 0) {
          setUserCount(start + count);
        }
      } else {
        const start = promoterCount;
        const count = Math.min(
          15,
          Math.max(0, promoterLeaderboard.length - start)
        );
        if (count > 0) {
          setPromoterCount(start + count);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card-section relative overflow-hidden p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Leaderboard
          </h2>
          <button
            onClick={fetchLeaderboards}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveLeaderboard("users")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium ${
              activeLeaderboard === "users"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Users className="w-5 h-5" />
            {leaderboardLabels.users}
          </button>
          <button
            onClick={() => setActiveLeaderboard("promoters")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium ${
              activeLeaderboard === "promoters"
                ? "bg-gradient-to-r from-purple-400 to-pink-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Trophy className="w-5 h-5" />
            {leaderboardLabels.promoters}
          </button>
        </div>

        {showMyRank && myRankEntry && (
          <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  My Rank • Top 50
                </p>
                <p className="text-lg font-semibold text-slate-900 mt-1">
                  #{myRankPosition} {myRankEntry.username || shortenAddress(myRankEntry.address)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-blue-600">
                  {formatScore(myRankEntry.new_score)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  POINTS
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading && filteredLeaderboard.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/60"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredLeaderboard.length > 0 ? (
          <div className="space-y-3">
            {filteredLeaderboard.map((entry, index) => {
              const rank = index + 1;
              const isTopThree = rank <= 3;
              const scoreChange = entry.new_score - entry.old_score;

              return (
                <div
                  key={entry.address}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md overflow-hidden ${
                    isTopThree
                      ? "border-yellow-300"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  {entry.pfp_url && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-10"
                      style={{
                        backgroundImage: `url(${entry.pfp_url})`,
                        backgroundBlendMode: "multiply",
                      }}
                    />
                  )}

                  {isTopThree && (
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-50 to-amber-50" />
                  )}

                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full font-bold overflow-hidden ${
                      rank === 1
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg"
                        : rank === 2
                        ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-md"
                        : rank === 3
                        ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {entry.pfp_url ? (
                      <>
                        <img
                          src={entry.pfp_url}
                          alt={entry.username || shortenAddress(entry.address)}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        <span
                          className={`absolute inset-0 flex items-center justify-center font-bold ${
                            isTopThree
                              ? "bg-slate-900/70 text-white text-3xl"
                              : "bg-slate-900/70 text-white text-xs"
                          }`}
                        >
                          {rank === 1
                            ? "🥇"
                            : rank === 2
                            ? "🥈"
                            : rank === 3
                            ? "🥉"
                            : `#${rank}`}
                        </span>
                      </>
                    ) : (
                      <span>
                        {rank === 1
                          ? "🥇"
                          : rank === 2
                          ? "🥈"
                          : rank === 3
                          ? "🥉"
                          : `#${rank}`}
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.username || shortenAddress(entry.address)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {scoreChange !== 0 && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            scoreChange > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {scoreChange > 0 ? "↑" : "↓"}
                          {formatScore(Math.abs(scoreChange))}
                        </span>
                      )}
                      {entry.old_score > 0 && (
                        <span className="text-xs text-slate-400">
                          from {formatScore(entry.old_score)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 text-right">
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {formatScore(entry.new_score)}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      POINTS
                    </p>
                  </div>
                </div>
              );
            })}

            {loadingMore && (
              <div className="flex items-center justify-center py-3 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading more...
              </div>
            )}
            <div ref={sentinelRef} className="h-px w-full" />
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <Trophy className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">
              No {leaderboardLabels[activeLeaderboard]} data available yet
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Check back later for leaderboard rankings
            </p>
          </div>
        )}

        {filteredLeaderboard.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing top {filteredLeaderboard.length}{" "}
              {leaderboardLabels[activeLeaderboard]}
              {filteredLeaderboard[0]?.updated_at && (
                <span className="ml-2">
                  • Last updated:{" "}
                  {new Date(
                    filteredLeaderboard[0].updated_at
                  ).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export { LeaderboardTab };
export default LeaderboardTab;

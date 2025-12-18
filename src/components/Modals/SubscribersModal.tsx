import React, { useState, useEffect, useCallback } from "react";
import { RotateCw } from "lucide-react";
import { ethers } from "ethers";
import post2EarnService, { RewardTokenMetadata } from "../../services/post2earn";
import threadService from "../../services/threadService";
import { Modal } from "../WalletInfo/Modal";
import { CloseButton } from "../UI/CloseButton";

interface SubscribersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SubscriberApiEntry = {
  _id: string;
  token: string;
  amount: number | string;
  expiresOn: number;
  subscriber: string;
  arenaUserId?: string;
  updated_at?: string;
};

type SubscriberUserData = {
  handle?: string;
  twitterHandle?: string;
  twitterName?: string;
  twitterPicture?: string;
};

const ARENA_LOGO_URL = `${import.meta.env.VITE_STATIC_ASSETS_URL || 'https://static.starsarena.com'}/uploads/95dc787e-19e4-3cc5-7a2b-1ec4c80f02531747905925081.png`;

const SubscriberTokenAvatar = ({ symbol, photoURL }: { symbol: string; photoURL: string | null | undefined }) => {
  const [imageError, setImageError] = useState(false);

  const imageUrl = symbol?.toUpperCase() === 'ARENA' ? ARENA_LOGO_URL : photoURL;

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-xs font-semibold text-blue-900 overflow-hidden border border-white/20 shadow-sm">
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={`${symbol} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{(symbol || 'T').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
};

const shortenAddress = (address?: string, lead: number = 6, tail: number = 4) => {
  if (!address) return "";
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
};

export const SubscribersModal: React.FC<SubscribersModalProps> = ({ isOpen, onClose }) => {
  const [subscriberList, setSubscriberList] = useState<SubscriberApiEntry[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [subscriberListLoading, setSubscriberListLoading] = useState(false);
  const [subscriberListError, setSubscriberListError] = useState<string | null>(null);
  const [subscriberTokenMetadata, setSubscriberTokenMetadata] = useState<Record<string, RewardTokenMetadata>>({});
  const [subscriberUserData, setSubscriberUserData] = useState<Record<string, SubscriberUserData>>({});

  const fetchSubscriberList = useCallback(async () => {
    setSubscriberListLoading(true);
    setSubscriberListError(null);

    try {
      // Assuming the API is proxied or accessible
      const response = await fetch("https://arena-plus-app-store.vercel.app/api/backend/subscribers");
      if (!response.ok) {
        throw new Error(`Failed to fetch subscribers (HTTP ${response.status})`);
      }
      const payload = await response.json();
      const rows: SubscriberApiEntry[] = Array.isArray(payload?.data) ? payload.data : [];

      setSubscriberList(rows);
      const resolvedCount = typeof payload?.count === "number" ? payload.count : rows.length;
      setSubscriberCount(resolvedCount);

      const uniqueTokens = Array.from(
        new Set(
          rows
            .map((entry) => entry.token)
            .filter((token): token is string => typeof token === "string" && ethers.isAddress(token))
            .map((token) => token.toLowerCase())
        )
      );

      if (uniqueTokens.length === 0) {
        return;
      }

      const metadataResults = await Promise.all(
        uniqueTokens.map(async (address) => {
          try {
            const metadata = await post2EarnService.getRewardTokenMetadata(address);
            return metadata ? ([address, metadata] as const) : null;
          } catch (error) {
            console.warn("Failed to fetch token metadata for subscriber token", address, error);
            return null;
          }
        })
      );

      setSubscriberTokenMetadata((prev) => {
        const updated = { ...prev };
        metadataResults.forEach((entry) => {
          if (entry) {
            const [address, metadata] = entry;
            updated[address] = metadata;
          }
        });
        return updated;
      });

      const userIdsToFetch = rows
        .map((entry) => entry.arenaUserId)
        .filter((id): id is string => Boolean(id));

      if (userIdsToFetch.length > 0) {
        const userDataResults = await Promise.all(
          userIdsToFetch.map(async (userId) => {
            try {
              const threads = await threadService.fetchRecentThreadsByUserId(userId, 1, 1);
              const thread = threads[0];

              if (thread?.user) {
                return {
                  userId,
                  userData: {
                    handle: thread.user.handle || thread.user.userHandle || thread.user.twitterHandle,
                    twitterHandle: thread.user.twitterHandle,
                    twitterName: thread.user.twitterName || thread.user.userName,
                    twitterPicture: thread.user.twitterPicture || thread.user.userPicture || thread.user.profilePicture,
                  },
                };
              }
              return null;
            } catch (error) {
              console.warn(`Failed to fetch user data for ${userId}`, error);
              return null;
            }
          })
        );

        const userDataMap: Record<string, SubscriberUserData> = {};
        userDataResults.forEach((result) => {
          if (result) {
            userDataMap[result.userId] = result.userData;
          }
        });
        setSubscriberUserData(userDataMap);
      }
    } catch (error) {
      console.error("Failed to load subscribers", error);
      setSubscriberListError(error instanceof Error ? error.message : "Failed to load subscribers");
    } finally {
      setSubscriberListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchSubscriberList();
    }
  }, [isOpen, fetchSubscriberList]);

  const subscriberTotal = subscriberCount ?? subscriberList.length;
  const hasSubscriberTotal = subscriberCount !== null || subscriberList.length > 0;
  const uniqueSubscriberTokens = new Set(
    subscriberList
      .map((entry) => (entry.token ? entry.token.toLowerCase() : undefined))
      .filter((token): token is string => Boolean(token))
  ).size;

  const getSubscriberTimeLeft = (expiresOn?: number) => {
    if (!expiresOn || Number.isNaN(Number(expiresOn))) return "Unknown";
    return post2EarnService.getTimeRemaining(Number(expiresOn));
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen>
      <div className="flex h-full w-full flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-title text-[0.65rem]">Registry</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">
              Subscriber Registry
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchSubscriberList()}
              disabled={subscriberListLoading}
              className={`inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 ${subscriberListLoading ? "cursor-not-allowed opacity-80" : ""
                }`}
            >
              <RotateCw className={`h-4 w-4 ${subscriberListLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <CloseButton onClick={onClose} />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-[92%] space-y-6 py-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total subscribers</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {hasSubscriberTotal ? subscriberTotal : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unique tokens</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {Number.isFinite(uniqueSubscriberTokens) ? uniqueSubscriberTokens : "—"}
                </p>
              </div>
            </div>

            {subscriberListLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-500">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                Fetching subscriber list...
              </div>
            ) : subscriberListError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold">Unable to load subscribers</p>
                <p className="text-xs text-rose-600/80">{subscriberListError}</p>
                <button
                  onClick={() => void fetchSubscriberList()}
                  className="mt-2 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700"
                >
                  Try again
                </button>
              </div>
            ) : subscriberList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No subscribers found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {subscriberList.map((entry) => {
                  const normalized = entry.token ? entry.token.toLowerCase() : "";
                  const metadata = subscriberTokenMetadata[normalized];
                  const tokenLabel = metadata?.symbol || shortenAddress(entry.token);
                  const timeLeft = getSubscriberTimeLeft(entry.expiresOn);
                  const userData = entry.arenaUserId ? subscriberUserData[entry.arenaUserId] : null;
                  const subscriberDisplay = userData?.handle
                    ? `@${userData.handle}`
                    : userData?.twitterHandle
                      ? `@${userData.twitterHandle}`
                      : shortenAddress(entry.subscriber, 6, 5);

                  return (
                    <div
                      key={entry._id ?? `${normalized}-${entry.subscriber}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-[100px]">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Token</p>
                          <div className="flex items-center gap-2 mt-1">
                            <SubscriberTokenAvatar symbol={tokenLabel} photoURL={null} />
                            <p className="text-sm font-semibold text-slate-900">{tokenLabel}</p>
                          </div>
                        </div>

                        <div className="flex-1 min-w-[140px] text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subscriber</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            {userData?.twitterPicture && (
                              <img
                                src={userData.twitterPicture}
                                alt={subscriberDisplay}
                                className="h-6 w-6 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <p className="text-sm font-semibold text-slate-900">{subscriberDisplay}</p>
                          </div>
                        </div>

                        <div className="min-w-[100px] text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time left</p>
                          <p className="text-sm font-semibold text-indigo-600">{timeLeft}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

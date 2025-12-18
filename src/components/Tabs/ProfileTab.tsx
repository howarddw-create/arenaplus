import { getBearerToken } from '../../services/post2earnService';
import React, { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRightIcon, LinkIcon, LogoutIcon } from '@hugeicons/core-free-icons';
// Small dropdown modal; no imports needed

interface ProfileTabProps {
  twitterUser: any;
  onTwitterLogin: () => void;
  onLogout: () => void;
}

interface ArenaUserProfile {
  id: string;
  createdOn?: string;
  twitterHandle?: string;
  twitterName?: string;
  twitterPicture?: string;
  lastLoginTwitterPicture?: string;
  twitterDescription?: string;
  address?: string;
  threadCount?: number;
  followerCount?: number;
  followingsCount?: number;
  twitterFollowers?: number;
  keyPrice?: string;
  handle?: string;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ twitterUser, onTwitterLogin, onLogout }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profile, setProfile] = useState<ArenaUserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Small dropdown modal: click outside to close
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowProfileModal(false);
      }
    };
    if (showProfileModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileModal]);

  useEffect(() => {
    const resolveProfile = async () => {
      if (!twitterUser?.user_metadata?.user_name) {
        setProfile(null);
        setProfileError(null);
        return;
      }

      const handle = twitterUser.user_metadata.user_name;
      setProfileLoading(true);
      setProfileError(null);

      try {
        const bearer = await getBearerToken();
        const response = await fetch(
          `https://api.starsarena.com/user/handle?handle=${encodeURIComponent(handle)}`,
          {
            headers: { Authorization: `Bearer ${bearer}` },
          }
        );

        if (!response.ok) {
          throw new Error('Unable to load Arena profile data');
        }

        const data = await response.json();
        if (data?.user) {
          setProfile(data.user as ArenaUserProfile);
        } else {
          setProfile(null);
          setProfileError('No Arena profile found yet. Open Arena Social briefly, then come back.');
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach Arena. Try opening Arena Social and refresh here.';
        setProfileError(message);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    resolveProfile();
  }, [twitterUser]);

  const truncateAddress = (value?: string | null) => {
    if (!value) return '-';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const formatNumber = (value?: number | null) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString();
  };

  const formatAvaxFromWei = (value?: string | null) => {
    if (!value) return '-';
    const num = Number(value) / 1e18;
    if (!Number.isFinite(num)) return '-';
    return `${num.toFixed(3)} AVAX`;
  };

  return (
    <div className="space-y-5 pb-4">

      {twitterUser && (
        <div className="flex items-center justify-end">
          <div className="relative">
            <div
              className="cursor-pointer"
              onClick={() => setShowProfileModal(!showProfileModal)}
            >
              {twitterUser.user_metadata?.picture ? (
                <img
                  src={twitterUser.user_metadata.picture}
                  alt="Profile"
                  className="h-10 w-10 rounded-full border-2 border-white shadow-lg transition-opacity hover:opacity-90"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90">
                  {(twitterUser.user_metadata?.user_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile dropdown - small modal */}
            {showProfileModal && (
              <div
                ref={modalRef}
                className="absolute right-0 top-12 z-[9999] w-56 rounded-xl border border-white/60 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur"
              >
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-xs font-semibold uppercase text-white">
                    {(twitterUser.user_metadata?.user_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-700">@{twitterUser.user_metadata?.user_name || 'user'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    onLogout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                >
                  <HugeiconsIcon icon={LogoutIcon} className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Account Connection Card */}
        {!twitterUser && (
          <div className="card-section p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title text-[0.65rem]">Profile</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-800">Your Arena identity</h3>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-4 text-sm text-slate-600">
              Connect your X (formerly Twitter) account to unlock leaderboard tracking and personalized insights.
            </div>

            <button
              onClick={onTwitterLogin}
              className="gradient-button mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
            >
              <HugeiconsIcon icon={LinkIcon} className="h-5 w-5" />
              Link X Account
            </button>
          </div>
        )}
        {twitterUser && profileError && (
          <div className="rounded-xl border border-rose-200/60 bg-rose-50/70 px-4 py-3 text-sm text-rose-600">
            {profileError}
          </div>
        )}
        {twitterUser && profileLoading && !profile && (
          <div className="card-section p-5 text-sm text-slate-500">
            Fetching Arena profile details...
          </div>
        )}
        {twitterUser && profile && (
          <div className="card-section p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {profile.twitterPicture || profile.lastLoginTwitterPicture ? (
                  <img
                    src={profile.twitterPicture || profile.lastLoginTwitterPicture}
                    alt={profile.twitterHandle || 'Arena profile avatar'}
                    className="h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-xl font-semibold text-white shadow">
                    {(profile.twitterHandle || profile.twitterName || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {profile.twitterName || profile.twitterHandle || 'Arena User'}
                  </h3>
                  {profile.twitterHandle && (
                    <p className="text-sm text-slate-500">@{profile.twitterHandle}</p>
                  )}
                  {profile.createdOn && (
                    <p className="text-xs text-slate-400">
                      Joined {new Date(profile.createdOn).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {profile.handle && (
                <a
                  href={`https://arena.social/${profile.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  View on Arena
                  <HugeiconsIcon icon={ArrowUpRightIcon} className="h-4 w-4" />
                </a>
              )}
            </div>

            {profile.twitterDescription && (
              <div className="mt-4 rounded-2xl border border-white/60 bg-white/80 p-4 text-sm text-slate-600">
                <span
                  dangerouslySetInnerHTML={{ __html: profile.twitterDescription }}
                />
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-blue-100 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Followers
                </p>
                <p className="text-xl font-semibold text-blue-700">
                  {formatNumber(profile.followerCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Following
                </p>
                <p className="text-xl font-semibold text-emerald-700">
                  {formatNumber(profile.followingsCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-sky-100 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
                  Posts
                </p>
                <p className="text-xl font-semibold text-sky-700">
                  {formatNumber(profile.threadCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-indigo-100 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  Twitter Followers
                </p>
                <p className="text-xl font-semibold text-indigo-700">
                  {formatNumber(profile.twitterFollowers)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs uppercase tracking-wide text-slate-400">Primary Wallet</p>
                <p className="mt-1 font-mono text-sm text-slate-700">
                  {truncateAddress(profile.address)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs uppercase tracking-wide text-slate-400">Key Price</p>
                <p className="mt-1 font-semibold text-slate-700">
                  {formatAvaxFromWei(profile.keyPrice)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

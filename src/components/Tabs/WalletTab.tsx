import React, { useEffect, useState } from "react";
import { WalletInfo, TokenInfo } from "../../types";
import { Modal } from "../WalletInfo/Modal";
import { DepositQRCode } from "../WalletInfo/DepositQRCode";
import { WithdrawModal } from "../WalletInfo/WithdrawModal";
import { TokenDisplay } from "../WalletInfo/TokenDisplay";
import { WalletExplorer } from "../WalletInfo/WalletExplorer";
import { IconButton } from "../UI/IconButton";
import { SupportedTokens } from "../UI/SupportedTokens";
// import { useTokenVesting } from "../../hooks/useTokenVesting";
import { TokenVestingModal } from "../Modals/TokenVestingModal";
import { TOKENS } from "../../constants";
import { useRewardClaims } from "../../hooks/useRewardClaims";
import useWalletTokenBalances, { WalletTokenBalance } from "../../hooks/useWalletTokenBalances";
import { useCommunityImages } from "../../hooks/useCommunityImages";

interface WalletTabProps {
  wallet: WalletInfo | null;
  tokens: TokenInfo[];
  showPrivateKey: boolean;
  showMnemonic: boolean;
  setShowPrivateKey: (show: boolean) => void;
  setShowMnemonic: (show: boolean) => void;
  onTransfer: (e: React.FormEvent) => Promise<boolean>;
  recipientAddress: string;
  setRecipientAddress: (address: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  loading: boolean;
  transferError: string | null;
  selectedToken: string;
  setSelectedToken: (token: string) => void;
  refreshTokenBalances?: () => void;
}

// Helper function to truncate address
const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

const formatTimeRemaining = (secondsRemaining: number) => {
  if (!Number.isFinite(secondsRemaining)) {
    return "Unknown";
  }

  if (secondsRemaining <= 0) {
    return "Ready to claim";
  }

  const totalSeconds = Math.max(0, Math.floor(secondsRemaining));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.slice(0, 2).join(" ");
};

export const WalletTab: React.FC<WalletTabProps> = ({
  wallet,
  tokens,
  showPrivateKey,
  showMnemonic,
  setShowPrivateKey,
  setShowMnemonic,
  onTransfer,
  recipientAddress,
  setRecipientAddress,
  transferAmount,
  setTransferAmount,
  loading,
  transferError,
  selectedToken,
  setSelectedToken,
  refreshTokenBalances,
}) => {
  const [activeSection, setActiveSection] = useState<
    "tokens" | "wallet" | "rewards" | "explorer"
  >("tokens");

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  // removed supported tokens modal; we'll show inline instead

  // Tokens supported by the platform (displayed in the header)
  const supportedTokens = TOKENS;

  // const { data: vestingData } = useTokenVesting(wallet?.address);
  const {
    rewards: unclaimedRewards,
    loading: rewardsLoading,
    error: rewardsError,
    claimingId,
    claimReward,
    refresh: refreshRewards,
  } = useRewardClaims(wallet);

  const {
    balances: tokenBalances,
    loading: balancesLoading,
    refresh: refreshBalances,
  } = useWalletTokenBalances(wallet, tokens);

  // Fetch community images for all tokens
  const tokenTickers = tokenBalances
    .filter(t => !t.isNative)
    .map(t => t.symbol);
  const { communities } = useCommunityImages(tokenTickers);

  const [claimStatus, setClaimStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(() =>
    Math.floor(Date.now() / 1000)
  );
  const [showVestingModal, setShowVestingModal] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (claimStatus) {
      const timer = window.setTimeout(() => setClaimStatus(null), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [claimStatus]);

  const handleClaimReward = async (
    promotionId: number,
    source: "v2" | "legacy"
  ) => {
    setClaimStatus(null);
    try {
      await claimReward(promotionId, source);
      setClaimStatus({
        type: "success",
        message: "Reward claimed successfully.",
      });
      refreshTokenBalances?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to claim reward.";
      setClaimStatus({ type: "error", message });
    }
  };

  return (
    <div className="space-y-5 pb-2">
      {wallet && (
        <>
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-nowrap items-center gap-2">
                {(
                  [
                    { id: "tokens", label: "Tokens" },
                    { id: "wallet", label: "Wallet" },
                    { id: "rewards", label: "Rewards" },
                    { id: "explorer", label: "Explorer" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                      activeSection === item.id
                        ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg"
                        : "border border-white/60 bg-white/60 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {/* Header kept clean; tokens info moved near actions */}
            </div>
            {/* Removed 'Synced' and 'tokens detected' chips */}
          </div>

          {/* Tokens Section */}
          {activeSection === "tokens" && (
            <div className="space-y-4">
              <div className="card-section p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="section-title text-[0.65rem]">Portfolio</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-800">
                      Your Tokens
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
                    Avalanche C-Chain
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {tokenBalances.length === 0 && !balancesLoading && (
                    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6 text-center text-sm text-slate-500">
                      <p className="font-semibold text-slate-700">
                        No tokens found in your wallet yet.
                      </p>
                      <p className="mt-2">
                        Kickstart your portfolio by depositing assets.
                      </p>
                    </div>
                  )}

                  {tokenBalances.map((t: WalletTokenBalance) => {
                    const community = communities[t.symbol.toLowerCase()];
                    return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur"
                    >
                      <div className="flex items-center gap-3">
                        <TokenDisplay
                          symbol={t.symbol}
                          photoURL={community?.photoURL}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/10 to-emerald-500/10"
                        />
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Token
                          </p>
                          <p className="text-base font-semibold text-slate-800">
                            {t.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Balance
                        </p>
                        <p className="text-base font-semibold text-slate-800">
                          {t.formattedBalance}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="gradient-button flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="gradient-button flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Withdraw
                  </button>
                </div>

                {/* Inline supported tokens (single row) */}
                <div className="mt-3 flex justify-center">
                  <SupportedTokens tokens={supportedTokens} useModal={false} maxVisible={10} />
                </div>

                {/* Deposit Modal */}
                <Modal
                  isOpen={showDepositModal}
                  onClose={() => setShowDepositModal(false)}
                  fullScreen
                >
                  {wallet && (
                    <DepositQRCode
                      walletAddress={wallet.address}
                      onClose={() => setShowDepositModal(false)}
                    />
                  )}
                </Modal>

                {/* Withdraw Modal */}
                <Modal
                  isOpen={showWithdrawModal}
                  onClose={() => setShowWithdrawModal(false)}
                  fullScreen
                >
                  <WithdrawModal
                    onClose={() => setShowWithdrawModal(false)}
                    recipientAddress={recipientAddress}
                    setRecipientAddress={setRecipientAddress}
                    transferAmount={transferAmount}
                    setTransferAmount={setTransferAmount}
                    onTransfer={onTransfer}
                    loading={loading}
                    transferError={transferError}
                    tokens={tokenBalances.map(t => ({
                      symbol: t.symbol,
                      name: t.name,
                      balance: t.numericBalance.toString(),
                      decimals: t.decimals,
                      address: t.tokenAddress,
                      isNative: t.isNative,
                    }))}
                    selectedToken={selectedToken}
                    setSelectedToken={setSelectedToken}
                  />
                </Modal>

                {/* End inline supported tokens */}
              </div>
            </div>
          )}

          {activeSection === "rewards" && (
            <div className="space-y-4">
              <div className="card-section p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="section-title text-[0.65rem]">Engagement</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-800">
                      Rewards
                    </h2>
                    <p className="text-sm text-slate-500">
                      Claim earnings from your promotion engagements as soon as
                      their windows open.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      void refreshRewards();
                      void refreshBalances();
                    }}
                    disabled={rewardsLoading || balancesLoading}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      rewardsLoading || balancesLoading
                        ? "cursor-not-allowed border border-slate-200 bg-white/70 text-slate-400"
                        : "gradient-button text-white shadow-lg"
                    }`}
                  >
                    {rewardsLoading || balancesLoading ? "Checking..." : "Refresh"}
                  </button>
                </div>

                {claimStatus && (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                      claimStatus.type === "success"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {claimStatus.message}
                  </div>
                )}

                {rewardsError && (
                  <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {rewardsError}
                  </div>
                )}

                {rewardsLoading && unclaimedRewards.length === 0 && (
                  <div className="mt-4 space-y-3">
                    {[0, 1].map((idx) => (
                      <div
                        key={idx}
                        className="animate-pulse rounded-xl border border-blue-100/70 bg-blue-50/60 p-4"
                      >
                        <div className="h-4 w-36 rounded bg-blue-100/80" />
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="h-3 rounded bg-blue-100/80" />
                          <div className="h-3 rounded bg-blue-100/80" />
                          <div className="h-3 rounded bg-blue-100/80" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!rewardsLoading &&
                  !rewardsError &&
                  unclaimedRewards.length === 0 && (
                    <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-600">
                      No unclaimed rewards found for this wallet. Come back
                      after completing a promotion to see it listed here.
                    </div>
                  )}

                {unclaimedRewards.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {unclaimedRewards.map((reward) => {
                      const secondsRemaining = reward.expiresOn - currentTime;
                      const isClaimable = secondsRemaining <= 0;
                      const expiryDate = reward.expiresOn
                        ? new Date(reward.expiresOn * 1000).toLocaleString()
                        : null;

                      return (
                        <div
                          key={`${reward.source}-${reward.promotionId}`}
                          className="rounded-2xl border border-white/60 bg-gradient-to-r from-white via-blue-50/80 to-white px-4 py-4 shadow-sm backdrop-blur"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                                Promotion {reward.source === 'legacy' ? '(Legacy)' : ''}
                              </p>
                              <p className="text-sm font-semibold text-slate-800">
                                #{reward.promotionId}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleClaimReward(reward.promotionId, reward.source)
                              }
                              disabled={
                                !isClaimable ||
                                claimingId === reward.promotionId
                              }
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                                !isClaimable ||
                                claimingId === reward.promotionId
                                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                  : "gradient-button text-white shadow-lg"
                              }`}
                            >
                              {claimingId === reward.promotionId
                                ? "Claiming..."
                                : "Claim"}
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Reward
                              </p>
                              <p className="text-base font-semibold text-slate-800">
                                {reward.rewardFormatted} {reward.source === 'legacy' ? 'PLUS' : 'ARENA'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">
                                Claim Window
                              </p>
                              <p className="text-base font-semibold text-slate-800">
                                {isClaimable
                                  ? "Ready to claim"
                                  : `Opens in ${formatTimeRemaining(
                                      secondsRemaining
                                    )}`}
                              </p>
                              {expiryDate && (
                                <p className="text-xs text-slate-500">
                                  {isClaimable ? "Expired on" : "Expires on"}{" "}
                                  {expiryDate}
                                </p>
                              )}
                            </div>
                            {reward.promoter && (
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  Promoter
                                </p>
                                <p className="text-sm text-slate-600">
                                  {truncateAddress(reward.promoter)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wallet Section */}
          {activeSection === "wallet" && (
            <div className="space-y-4">
              <div className="card-section p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="section-title text-[0.65rem]">Security</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-800">
                      Wallet Details
                    </h2>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Address
                    </p>
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-4 py-3 font-mono text-sm text-slate-700 shadow-sm">
                      <span>{truncateAddress(wallet.address)}</span>
                      <IconButton
                        onClick={() =>
                          navigator.clipboard.writeText(wallet.address)
                        }
                        title="Copy to clipboard"
                        className="text-blue-600 hover:text-blue-800"
                        icon={
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Private Key
                    </p>
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-4 py-3 font-mono text-sm text-slate-700 shadow-sm">
                      <span>
                        {showPrivateKey
                          ? truncateAddress(wallet.privateKey)
                          : "••••••••••••••••"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
                        >
                          {showPrivateKey ? "Hide" : "Show"}
                        </button>
                        {showPrivateKey && (
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(wallet.privateKey)
                            }
                            className="text-blue-600 transition hover:text-blue-800"
                            title="Copy to clipboard"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {wallet.mnemonic && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Recovery Phrase
                      </p>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-4 py-3 font-mono text-sm text-slate-700 shadow-sm">
                        <span>
                          {showMnemonic
                            ? truncateAddress(wallet.mnemonic)
                            : "••••••••••••••••"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowMnemonic(!showMnemonic)}
                            className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
                          >
                            {showMnemonic ? "Hide" : "Show"}
                          </button>
                          {showMnemonic && (
                            <IconButton
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  wallet.mnemonic || ""
                                )
                              }
                              title="Copy to clipboard"
                              className="text-blue-600 hover:text-blue-800"
                              icon={
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
                    <p className="font-semibold">Security warning</p>
                    <p className="mt-1">
                      Never share your private key or recovery phrase with
                      anyone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Explorer Section */}
          {activeSection === "explorer" && wallet && (
            <div className="space-y-4">
              <div className="card-section p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="section-title text-[0.65rem]">Explorer</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-800">
                      Transactions
                    </h2>
                  </div>
                </div>
                <div className="mt-4">
                  <WalletExplorer address={wallet.address} />
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          {wallet && (
            <TokenVestingModal
              isOpen={showVestingModal}
              onClose={() => setShowVestingModal(false)}
              walletAddress={wallet.address}
            />
          )}
        </>
      )}
    </div>
  );
};

export default WalletTab;

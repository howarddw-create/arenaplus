import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useWallet } from "./hooks/useWallet";
import { PasswordForm } from "./components/WalletCreate/PasswordForm";
import {
  BottomNavigation,
  TabType,
} from "./components/Navigation/BottomNavigation";
import { WalletTab } from "./components/Tabs/WalletTab";
import { ProfileTab } from "./components/Tabs/ProfileTab";
import { InventoryTab } from "./components/Tabs/InventoryTab";
import { DeepDiveTab } from "./components/Tabs/DeepDiveTab";
import { LeaderboardTab } from "./components/Tabs/LeaderboardTab";
import { Toast, ToastType } from "./components/UI/Toast";
import { TOKENS_MAP } from "./constants";

interface WalletActionSummary {
  id: string;
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  amount?: string;
  tokenSymbol?: string;
  status: "queued" | "awaiting_user" | "processing";
  position: number;
}

function App() {
  const [twitterUser, setTwitterUser] = useState<any>(null);
  const {
    wallet,
    loading,
    transferLoading,
    error,
    isUnlocked,
    tokens,
    init,
    unlockWallet,
    transferTokens,
    getTokenBalance,
  } = useWallet();

  const [_activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [activeNavTab, setActiveNavTab] = useState<TabType>("inventory");
  const [isExtension, setIsExtension] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [password, setPassword] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [walletActionQueue, setWalletActionQueue] = useState<
    WalletActionSummary[]
  >([]);
  const [walletActionDecisionLoading, setWalletActionDecisionLoading] =
    useState(false);

  const refreshTokenBalances = useCallback(() => {
    if (wallet?.address) {
      getTokenBalance(wallet.address);
    }
  }, [wallet?.address, getTokenBalance]);

  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({
      message,
      type,
      isVisible: true,
    });
  };

  const hideToast = () => {
    setToast((prev) => ({
      ...prev,
      isVisible: false,
    }));
  };

  const fetchAppState = () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: "GET_APP_STATE" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error getting app state:",
            chrome.runtime.lastError.message
          );
          return;
        }
        if (response?.twitterUser) {
          setTwitterUser(response.twitterUser);
        }
      });
    }
  };

  useEffect(() => {
    const isExtensionContext =
      typeof chrome !== "undefined" && chrome.runtime?.id;
    setIsExtension(!!isExtensionContext);

    if (isExtensionContext) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        setActiveTab(tabs[0]);
      });

      // Wallet setup check
      chrome.runtime.sendMessage({ type: "CHECK_WALLET_SETUP" }, (response) => {
        if (response?.isSetup) {
          init();
        } else {
          chrome.tabs.create({ url: "welcome.html" });
          window.close();
        }
      });

      // Fetch state when popup opens
      fetchAppState();

      // Listen for session updates from background script
      const messageListener = (message: any) => {
        if (message.type === "SESSION_UPDATED") {
          setTwitterUser(message.session?.user ?? null);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);

      // Handle deep linking via URL parameters
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam &&
        ["wallet", "inventory", "deepdive", "profile", "leaderboard"].includes(
          tabParam
        )
      ) {
        setActiveNavTab(tabParam as TabType);
      }

      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [init]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
    chrome.runtime.sendMessage(
      { type: "GET_WALLET_ACTION_QUEUE" },
      (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response?.queue) {
          setWalletActionQueue(response.queue);
        }
      }
    );

    const queueListener = (message: any) => {
      if (message.type === "WALLET_ACTION_QUEUE_UPDATED") {
        setWalletActionQueue(message.queue || []);
      }
    };
    chrome.runtime.onMessage.addListener(queueListener);
    return () => {
      chrome.runtime.onMessage.removeListener(queueListener);
    };
  }, []);

  const handleTwitterLogin = () => {
    chrome.runtime.sendMessage({ type: "TWITTER_LOGIN" }, (response) => {
      if (response && !response.success) {
        console.error("Twitter login failed:", response.error);
        showToast("Twitter login failed. Please try again.", "error");
      }
    });
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: "TWITTER_LOGOUT" }, (response) => {
      if (response && response.success) {
        setTwitterUser(null);
        showToast("You have been logged out.", "success");
      } else {
        console.error("Logout failed:", response.error);
        showToast("Logout failed. Please try again.", "error");
      }
    });
  };

  const handleWalletActionDecision = (approved: boolean) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
    const currentAction = walletActionQueue.find(
      (action) =>
        action.status === "awaiting_user" || action.status === "processing"
    );
    if (!currentAction) return;
    setWalletActionDecisionLoading(true);
    chrome.runtime.sendMessage(
      { type: "RESPOND_WALLET_ACTION", id: currentAction.id, approved },
      (response) => {
        setWalletActionDecisionLoading(false);
        if (chrome.runtime.lastError) {
          showToast(
            chrome.runtime.lastError.message ||
            "Failed to submit wallet decision.",
            "error"
          );
          return;
        }
        if (!response?.success) {
          showToast(response?.error || "Failed to submit decision.", "error");
        } else if (!approved) {
          showToast("Transaction request rejected.", "error");
        }
      }
    );
  };

  const handlePasswordSubmit = async () => {
    try {
      await unlockWallet(password);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferSubmit = async (e: FormEvent): Promise<boolean> => {
    e.preventDefault();
    setTransferError(null);

    if (!recipientAddress || !transferAmount) {
      setTransferError("Please provide both recipient address and amount");
      setTimeout(() => setTransferError(null), 5000);
      return false;
    }

    try {
      await transferTokens(recipientAddress, transferAmount, selectedToken);
      showToast(
        `Successfully transferred ${transferAmount} ${selectedToken}`,
        "success"
      );
      setTransferAmount("");
      setRecipientAddress("");
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setTransferError(errorMessage);
      console.error("Transfer error:", errorMessage);
      setTimeout(() => setTransferError(null), 5000);
      return false;
    }
  };

  const handleShowModal = () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_MODAL" });
        }
      });
    }
  };

  const activeWalletAction = walletActionQueue.find(
    (action) =>
      action.status === "awaiting_user" || action.status === "processing"
  );
  const queuedWalletActions = walletActionQueue.length;
  const shouldHideNav = Boolean(activeWalletAction);
  const containerStyle = shouldHideNav
    ? { width: "100%", height: "100%" }
    : { width: "408px", height: "580px" };
  const renderWalletActionModal = () => {
    if (!activeWalletAction) return null;
    const tokenSymbol = (activeWalletAction.tokenSymbol || "ARENA").toUpperCase();
    const tokenInfo = tokens.find(
      (token) => token.symbol?.toUpperCase() === tokenSymbol
    );
    const tokenConfig = TOKENS_MAP[tokenSymbol];
    const spendAmountRaw = Number(
      (activeWalletAction.amount || "").replace(/[^\d.]/g, "")
    );
    const spendAmount = Number.isNaN(spendAmountRaw) ? 0 : spendAmountRaw;
    const balanceNumeric = tokenInfo ? Number(tokenInfo.balance || 0) : null;

    // Allow approval even if token info not available (e.g., reward tokens not in TOKENS_MAP)
    const isWalletImpactReady = true; // Always ready, just show "Unknown" for missing tokens
    const insufficientBalance =
      tokenInfo && balanceNumeric !== null && spendAmount > balanceNumeric;
    const actionDisabled =
      walletActionDecisionLoading ||
      activeWalletAction.status === "processing" ||
      !isUnlocked ||
      !wallet ||
      insufficientBalance;

    return (
      <div className="pointer-events-auto absolute inset-0 z-40 flex justify-end bg-slate-900/80 backdrop-blur">
        <div className="ml-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-white text-slate-900">
          <div className="flex-1 overflow-hidden px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Transaction Request
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {activeWalletAction.title}
                </h3>
                {activeWalletAction.description && (
                  <p className="mt-1 text-sm text-slate-500">
                    {activeWalletAction.description}
                  </p>
                )}
              </div>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                {activeWalletAction.status === "processing"
                  ? "Processing"
                  : "Awaiting approval"}
              </span>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              {activeWalletAction.amount && (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-base font-semibold text-slate-900">
                    {activeWalletAction.amount}{" "}
                    {activeWalletAction.tokenSymbol || ""}
                  </span>
                </div>
              )}
              {Object.entries(activeWalletAction.details || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-slate-500">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span className="font-medium text-slate-900">
                      {String(value ?? "-")}
                    </span>
                  </div>
                )
              )}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <span>Wallet Impact</span>
                  <span>{tokenSymbol}</span>
                </div>
                {tokenInfo ? (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {tokenConfig?.image ? (
                        <img
                          src={tokenConfig.image}
                          alt={tokenInfo.symbol}
                          className={`h-9 w-9 ${tokenConfig.isRounded ? "rounded-full" : "rounded-lg"
                            } border border-white shadow`}
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-slate-200 text-center text-sm font-semibold leading-9 text-slate-600">
                          {tokenInfo.symbol[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-slate-500">You will spend</p>
                        <p className="text-base font-semibold text-slate-900">
                          - {activeWalletAction.amount} {tokenSymbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      Balance: {balanceNumeric?.toFixed(4)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-600">
                    <p className="font-medium">You will spend:</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {activeWalletAction.amount} {tokenSymbol}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Balance check unavailable for this token
                    </p>
                  </div>
                )}
              </div>
              {insufficientBalance && (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  Insufficient balance. You need {spendAmount.toFixed(4)}{" "}
                  {tokenSymbol}, but only {balanceNumeric?.toFixed(4)} available.
                </p>
              )}
              <div className="mt-12 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleWalletActionDecision(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleWalletActionDecision(true)}
                  disabled={actionDisabled}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeWalletAction.status === "processing"
                    ? "Processing..."
                    : walletActionDecisionLoading
                      ? "Confirming..."
                      : insufficientBalance
                        ? "Insufficient"
                        : !isWalletImpactReady
                          ? "Preparing..."
                          : "Approve"}
                </button>
              </div>
            </div>
            {!isUnlocked && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                Unlock your wallet to approve this request.
              </p>
            )}
          </div>
          {queuedWalletActions > 1 && (
            <p className="px-6 pb-4 text-xs text-slate-400">
              {queuedWalletActions - 1} more request
              {queuedWalletActions - 1 === 1 ? "" : "s"} in queue
            </p>
          )}
        </div>
      </div>
    );
  };
  const walletActionModal = renderWalletActionModal();
  useEffect(() => {
    if (shouldHideNav) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [shouldHideNav]);

  const rootClass = shouldHideNav
    ? "relative h-full w-full overflow-hidden bg-white"
    : "relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-white shadow-2xl";

  if (!isExtension) {
    return (
      <div
        style={containerStyle}
        className={
          shouldHideNav
            ? "relative h-full w-full overflow-hidden bg-white text-slate-100"
            : "relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100"
        }
      >
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -right-20 top-10 h-56 w-56 rounded-full bg-gradient-to-br from-sky-500/50 to-emerald-500/40 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-gradient-to-br from-blue-400/40 to-emerald-500/40 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          <span className="section-title tracking-[0.6em] text-slate-300">
            Dev Only
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Arena Extension Shell</h1>
          <p className="mt-3 text-sm text-slate-300">
            This experience is designed for the Chrome extension. Launch the
            extension build to explore the full UI.
          </p>
        </div>
        {walletActionModal}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={containerStyle}
        className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-white"
      >
        <div className="absolute inset-0">
          <div className="absolute -top-20 left-1/3 h-48 w-48 rounded-full bg-gradient-to-br from-sky-400/40 to-emerald-400/40 blur-3xl" />
          <div className="absolute bottom-[-60px] right-[-30px] h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-300/40 to-sky-400/30 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-white/50 shadow-xl">
            <svg
              className="h-7 w-7 animate-spin text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V2C6.477 2 2 6.477 2 12h2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-700">
              Preparing your experience
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Hang tight while we sync your wallet and features.
            </p>
          </div>
        </div>
        {walletActionModal}
      </div>
    );
  }

  if (!isUnlocked || !wallet) {
    return (
      <div
        style={containerStyle}
        className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-white p-8"
      >
        <div className="absolute inset-0 opacity-70">
          <div className="absolute -left-10 top-1/4 h-40 w-40 rounded-full bg-gradient-to-br from-sky-500/20 to-emerald-500/30 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-48 w-48 rounded-full bg-gradient-to-br from-blue-400/20 to-emerald-500/20 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-center gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 shadow-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-800">
              Unlock your vault
            </h1>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              Access your Arena wallet and manage assets with secure controls.
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-600">
              <p className="font-medium">{error}</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
            <PasswordForm
              password={password}
              setPassword={setPassword}
              onSubmit={handlePasswordSubmit}
              loading={loading}
            />
          </div>
        </div>
        {walletActionModal}
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      className={rootClass}
    >
      {!shouldHideNav && (
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-gradient-to-br from-sky-500/10 to-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-[-90px] right-[-50px] h-64 w-64 rounded-full bg-gradient-to-tl from-indigo-400/10 to-sky-300/20 blur-3xl" />
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {walletActionModal}

      <div className="relative flex h-full min-h-0 flex-col">
        {!shouldHideNav && (
          <header className="flex items-center justify-between px-5 pt-5">
            <div>
              <span className="section-title">Arena Plus</span>
            </div>
            {wallet && (
              <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {wallet?.address.slice(0, 6)}...{wallet?.address.slice(-4)}
              </div>
            )}
          </header>
        )}

        <div
          className={`content-container relative flex-1 min-h-0 overflow-y-auto px-0 ${shouldHideNav ? "pb-0 pt-0" : "pb-36 pt-4"
            }`}
          style={{ scrollbarGutter: "stable" }}
        >
          <div
            className={`mx-auto ${shouldHideNav ? "w-full px-6" : "w-[92%]"}`}
          >
            {activeNavTab === "wallet" && (
              <WalletTab
                wallet={wallet}
                tokens={tokens}
                showPrivateKey={showPrivateKey}
                setShowPrivateKey={setShowPrivateKey}
                showMnemonic={showMnemonic}
                setShowMnemonic={setShowMnemonic}
                onTransfer={handleTransferSubmit}
                recipientAddress={recipientAddress}
                setRecipientAddress={setRecipientAddress}
                transferAmount={transferAmount}
                setTransferAmount={setTransferAmount}
                loading={transferLoading}
                transferError={transferError}
                selectedToken={selectedToken}
                setSelectedToken={setSelectedToken}
                refreshTokenBalances={refreshTokenBalances}
              />
            )}
            {activeNavTab === "inventory" && (
              <InventoryTab onShowModal={handleShowModal} />
            )}
            {activeNavTab === "deepdive" && wallet && (
              <DeepDiveTab heldTokens={tokens} walletAddress={wallet.address} />
            )}
            {activeNavTab === "profile" && (
              <ProfileTab
                twitterUser={twitterUser}
                onTwitterLogin={handleTwitterLogin}
                onLogout={handleLogout}
              />
            )}
            {activeNavTab === "leaderboard" && <LeaderboardTab />}
          </div>
        </div>

        {!shouldHideNav && (
          <BottomNavigation
            activeTab={activeNavTab}
            onTabChange={setActiveNavTab}
          />
        )}
      </div>
    </div>
  );
}

export default App;

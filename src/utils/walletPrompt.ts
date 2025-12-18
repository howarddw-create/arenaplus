export type WalletStatusPayload = {
  isUnlocked?: boolean;
  hasWallet?: boolean;
};

const WALLET_UNLOCK_TIMEOUT_MS = 60_000;
const WALLET_UNLOCK_POLL_INTERVAL_MS = 500;

function isRuntimeAvailable() {
  return typeof chrome !== "undefined" && !!chrome.runtime?.id;
}

export function getWalletStatus(): Promise<WalletStatusPayload | null> {
  return new Promise((resolve) => {
    if (!isRuntimeAvailable()) {
      resolve(null);
      return;
    }
    chrome.runtime.sendMessage({ type: "CHECK_WALLET_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[AREX] Failed to check wallet status:",
          chrome.runtime.lastError.message
        );
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

export function promptWalletUnlock(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!isRuntimeAvailable()) {
        resolve(false);
        return;
      }
      chrome.runtime.sendMessage(
        { type: "PROMPT_UNLOCK_WALLET" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[AREX] Failed to prompt wallet unlock:",
              chrome.runtime.lastError.message
            );
            resolve(false);
            return;
          }
          resolve(Boolean(response?.success));
        }
      );
    } catch (err) {
      console.warn("[AREX] Unexpected error prompting wallet unlock", err);
      resolve(false);
    }
  });
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function waitForWalletUnlock(
  timeoutMs = WALLET_UNLOCK_TIMEOUT_MS,
  pollIntervalMs = WALLET_UNLOCK_POLL_INTERVAL_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getWalletStatus();
    if (status?.isUnlocked) {
      return true;
    }
    await sleep(pollIntervalMs);
  }
  return false;
}

export async function promptAndWaitForWalletUnlock(): Promise<boolean> {
  const prompted = await promptWalletUnlock();
  if (!prompted) {
    return false;
  }
  return waitForWalletUnlock();
}

export const walletPromptConstants = {
  WALLET_UNLOCK_TIMEOUT_MS,
  WALLET_UNLOCK_POLL_INTERVAL_MS,
};

import { TOKENS_MAP, PARTNER_TOKENS } from "../constants";
import { showToast } from "../utils/toast";
import {
  getWalletStatus,
  promptAndWaitForWalletUnlock,
} from "../utils/walletPrompt";

type TipShowerRecipient = {
  handle: string;
  address: string;
};

type TipShowerLikeTarget = {
  handle: string;
  button: HTMLElement | null;
  likeId: string;
};

type TipShowerApprovalWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

let isShowerActive = false;
let currentTipShowerContextId: string | null = null;
let currentTipShowerTotal = 0;
let tipShowerProgressListenerRegistered = false;
let currentTipShowerLikeTargets: TipShowerLikeTarget[] = [];
let currentTipShowerLastLikedIndex = 0;
let currentTipShowerMeta: { amount: string; tokenSymbol: string } | null = null;
const tipShowerApprovalWaiters = new Map<string, TipShowerApprovalWaiter>();

const POST_SELECTOR = "div.flex.flex-col.border-b";
const LIKE_PATH_SELECTOR = "button svg path[d^='M352.92 80']";

const tipShowerListener = (
  message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { status: string }) => void
) => {
  if (message.type === "SHOW_TIP_SHOWER_MODAL") {
    openShowerModal();
    sendResponse({ status: "ok" });
  }
};

function registerTipShowerProgressListener() {
  if (tipShowerProgressListenerRegistered) return;
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "TIP_SHOWER_APPROVAL_GRANTED") {
      resolveTipShowerApproval(message.contextId);
      return;
    }
    if (message?.type === "TIP_SHOWER_APPROVAL_DENIED") {
      rejectTipShowerApproval(message.contextId, message.error);
      return;
    }
    if (
      message?.type !== "TIP_SHOWER_PROGRESS" ||
      !message.contextId ||
      message.contextId !== currentTipShowerContextId
    ) {
      return;
    }

    const total =
      typeof message.total === "number" && message.total > 0
        ? message.total
        : currentTipShowerTotal || currentTipShowerLikeTargets.length || 0;

    if (message.status === "processing") {
      if (message.processed === 0) {
        setShowerStatusText("Preparing tip shower...");
      }
    }

    if (typeof message.processed === "number" && total > 0) {
      const processed = Math.min(message.processed, total);
      syncTipShowerLikes(processed);
      updateShowerProgress(processed, total);
    }

    if (message.status === "completed") {
      showToast("Tip shower complete!");
      endTipShowerSession("Tip shower complete!");
    } else if (message.status === "failed") {
      showToast(message.error || "Tip shower failed.");
      endTipShowerSession("Tip shower failed.");
    }
  });
  tipShowerProgressListenerRegistered = true;
}

function resolveTipShowerApproval(contextId?: string) {
  if (!contextId) return;
  const waiter = tipShowerApprovalWaiters.get(contextId);
  if (waiter) {
    clearTimeout(waiter.timeoutId);
    tipShowerApprovalWaiters.delete(contextId);
    waiter.resolve();
  }
}

function rejectTipShowerApproval(contextId?: string, error?: string) {
  if (!contextId) return;
  const waiter = tipShowerApprovalWaiters.get(contextId);
  if (waiter) {
    clearTimeout(waiter.timeoutId);
    tipShowerApprovalWaiters.delete(contextId);
    waiter.reject(new Error(error || "Wallet approval rejected."));
  }
}

function waitForTipShowerApproval(
  contextId: string,
  timeoutMs = 120_000
): Promise<void> {
  if (tipShowerApprovalWaiters.has(contextId)) {
    const existing = tipShowerApprovalWaiters.get(contextId);
    if (existing) {
      clearTimeout(existing.timeoutId);
      tipShowerApprovalWaiters.delete(contextId);
    }
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      tipShowerApprovalWaiters.delete(contextId);
      reject(new Error("Wallet approval timed out."));
    }, timeoutMs);

    tipShowerApprovalWaiters.set(contextId, {
      timeoutId,
      resolve: () => {
        clearTimeout(timeoutId);
        tipShowerApprovalWaiters.delete(contextId);
        resolve();
      },
      reject: (err: Error) => {
        clearTimeout(timeoutId);
        tipShowerApprovalWaiters.delete(contextId);
        reject(err);
      },
    });
  });
}

function requestTipShowerApproval(
  contextId: string,
  count: number,
  amountPerTip: string,
  tokenSymbol: string
): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "REQUEST_TIP_SHOWER_APPROVAL",
        payload: {
          contextId,
          count,
          amountPerTip,
          tokenSymbol,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to request tip shower approval",
            chrome.runtime.lastError
          );
          resolve(false);
          return;
        }
        resolve(!!response?.success);
      }
    );
  });
}

function cancelTipShowerApproval(
  contextId: string,
  reason?: string
): Promise<void> {
  if (!contextId || typeof chrome === "undefined" || !chrome.runtime?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "CANCEL_TIP_SHOWER_APPROVAL",
        contextId,
        reason,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "Failed to cancel tip shower approval",
            chrome.runtime.lastError
          );
        }
        resolve();
      }
    );
  });
}

function openShowerModal() {
  if (document.getElementById("tip-shower-modal")) return;

  const modal = document.createElement("div");
  modal.id = "tip-shower-modal";
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.zIndex = "2147483647";
  modal.style.background = "#1a1b1e";
  modal.style.borderRadius = "12px";
  modal.style.boxShadow = "0 8px 30px rgba(0,0,0,0.5)";
  modal.style.padding = "24px";
  modal.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  modal.style.border = "1px solid #333";
  modal.style.width = "420px";

  const options = PARTNER_TOKENS.map(
    (token) => `<option value="${token.symbol}">${token.symbol}</option>`
  ).join("");

  modal.innerHTML = `
    <h2 style="font-size:20px;font-weight:600;margin:0 0 16px; color: #fff;">Tip Shower</h2>
    <label style="display:block;margin-bottom:8px;font-size:14px; color: #aaa;">Number of posts (Max 50)</label>
    <input id="shower-count" type="number" value="5" min="1" max="50" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #444;border-radius:8px;margin-bottom:16px;background:#101010;color:#fff;font-size:14px;" />
    <label style="display:block;margin-bottom:8px;font-size:14px; color: #aaa;">Tip amount (Per Post)</label>
    <input id="shower-amount" type="number" value="1" min="0" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #444;border-radius:8px;margin-bottom:16px;background:#101010;color:#fff;font-size:14px;" />
    <label style="display:block;margin-bottom:8px;font-size:14px; color: #aaa;">Tip token</label>
    <div style="position: relative;">
      <select id="shower-token" style="width:100%;box-sizing:border-box;padding:10px 40px 10px 10px;border:1px solid #444;border-radius:8px;margin-bottom:24px;background:#101010;color:#fff;font-size:14px; -webkit-appearance: none; -moz-appearance: none; appearance: none;">
        ${options}
      </select>
      <div style="position:absolute;right:12px;top:10px;pointer-events:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:12px;">
      <button id="shower-cancel" style="padding:10px 16px;border:1px solid #555;border-radius:8px;cursor:pointer;background:transparent;color:#fff;font-weight:600;font-size:14px;transition:background-color 0.2s;">Cancel</button>
      <button id="shower-start" style="padding:10px 16px;background:#eb540a;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;transition:background-color 0.2s;">Start</button>
    </div>`;

  document.body.appendChild(modal);

  const cancel = modal.querySelector("#shower-cancel") as HTMLButtonElement;
  cancel.addEventListener("click", () => modal.remove());
  cancel.addEventListener("mouseenter", () => {
    cancel.style.backgroundColor = "#333";
  });
  cancel.addEventListener("mouseleave", () => {
    cancel.style.backgroundColor = "transparent";
  });

  const startButton = modal.querySelector("#shower-start") as HTMLButtonElement;
  startButton.addEventListener("mouseenter", () => {
    startButton.style.backgroundColor = "#ff6a1a";
  });
  startButton.addEventListener("mouseleave", () => {
    startButton.style.backgroundColor = "#eb540a";
  });

  startButton.addEventListener("click", () => {
    const countInput = modal.querySelector("#shower-count") as HTMLInputElement;
    const amountInput = modal.querySelector(
      "#shower-amount"
    ) as HTMLInputElement;
    const tokenInput = modal.querySelector(
      "#shower-token"
    ) as HTMLSelectElement;
    const count = Math.min(
      50,
      Math.max(1, parseInt(countInput.value, 10) || 1)
    );
    const amount = amountInput.value || "1";
    const token = tokenInput.value || "PLUS";
    modal.remove();
    startTipShower(count, amount, token);
  });
}

function createTipShowerButton() {
  const button = document.createElement("button");
  button.className =
    "inline-flex relative overflow-hidden items-center justify-center whitespace-nowrap rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none border border-gray-text text-off-white text-sm font-semibold hover:bg-gray-text/10 size-[38px] flex-shrink-0 p-0";
  button.type = "button";

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "transparent";
  });

  const iconContainer = document.createElement("div");
  iconContainer.className =
    "inline-flex items-center justify-center gap-1 transition-[opacity,transform] duration-300 translate-y-[0%]";
  iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shower-head-icon lucide-shower-head size-4 text-gray-text" style="opacity: 0.8;"><path d="m4 4 2.5 2.5"/><path d="M13.5 6.5a4.95 4.95 0 0 0-7 7"/><path d="M15 5 5 15"/><path d="M14 17v.01"/><path d="M10 16v.01"/><path d="M13 13v.01"/><path d="M16 10v.01"/><path d="M11 20v.01"/><path d="M17 14v.01"/><path d="M20 11v.01"/></svg>`;
  button.appendChild(iconContainer);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    openShowerModal();
  });

  return button;
}

function injectProfileTipShowerButton() {
  const desktopSelector =
    "div.hidden.w-full.gap-\\[10px\\].sm\\:flex.sm\\:items-center";
  const desktopContainer = document.querySelector(desktopSelector);

  const moreButtonSelector = 'button[id^="radix-"][aria-haspopup="menu"]';

  if (desktopContainer) {
    if (!desktopContainer.querySelector("#profile-tip-shower-btn")) {
      const moreButton = desktopContainer.querySelector(moreButtonSelector);
      if (moreButton) {
        const button = createTipShowerButton();
        button.id = "profile-tip-shower-btn";
        moreButton.parentElement?.insertBefore(button, moreButton);
      }
    }
  }

  const mobileSelector =
    "div.mt-5.flex.items-center.gap-\\[10px\\].sm\\:hidden";
  const mobileContainer = document.querySelector(mobileSelector);
  if (mobileContainer) {
    if (!mobileContainer.querySelector("#profile-tip-shower-btn-mobile")) {
      const moreButton = mobileContainer.querySelector(moreButtonSelector);
      if (moreButton) {
        const button = createTipShowerButton();
        button.id = "profile-tip-shower-btn-mobile";
        moreButton.parentElement?.insertBefore(button, moreButton);
      }
    }
  }
}

function setShowerStatusText(text: string) {
  const progressText = document.getElementById("shower-progress-text");
  if (progressText) {
    progressText.textContent = text;
  }
}

function showShowerLoader() {
  if (document.getElementById("tip-shower-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "tip-shower-backdrop";
  backdrop.style.position = "fixed";
  backdrop.style.top = "0";
  backdrop.style.left = "0";
  backdrop.style.width = "100%";
  backdrop.style.height = "100%";
  backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  backdrop.style.backdropFilter = "blur(5px)";
  backdrop.style.zIndex = "2147483647";
  backdrop.style.display = "flex";
  backdrop.style.justifyContent = "center";
  backdrop.style.alignItems = "center";
  backdrop.style.flexDirection = "column";
  backdrop.style.color = "#fff";
  backdrop.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

  const spinner = document.createElement("div");
  spinner.style.border = "4px solid rgba(255, 255, 255, 0.3)";
  spinner.style.borderTop = "4px solid #fff";
  spinner.style.borderRadius = "50%";
  spinner.style.width = "40px";
  spinner.style.height = "40px";
  spinner.style.animation = "spin 1s linear infinite";
  spinner.style.marginBottom = "20px";

  const keyframes = `
  @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
  }`;
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = keyframes;
  document.head.appendChild(styleSheet);

  const text = document.createElement("p");
  text.id = "shower-progress-text";
  text.textContent = "Preparing tip shower...";
  text.style.fontSize = "18px";
  text.style.fontWeight = "600";

  backdrop.appendChild(spinner);
  backdrop.appendChild(text);

  document.body.appendChild(backdrop);
}

function updateShowerProgress(tipped: number, total?: number) {
  const safeTotal =
    typeof total === "number" && total > 0
      ? total
      : currentTipShowerTotal || currentTipShowerLikeTargets.length || tipped;
  const denominator = safeTotal > 0 ? safeTotal : 1;
  const boundedTipped = Math.min(tipped, denominator);
  setShowerStatusText(`Showering tips... (${boundedTipped} / ${denominator})`);
}

function hideShowerLoader() {
  const backdrop = document.getElementById("tip-shower-backdrop");
  if (backdrop) {
    backdrop.remove();
  }
}

function resetTipShowerTracking() {
  currentTipShowerLikeTargets = [];
  currentTipShowerLastLikedIndex = 0;
  currentTipShowerContextId = null;
  currentTipShowerTotal = 0;
  currentTipShowerMeta = null;
}

function endTipShowerSession(statusText?: string) {
  if (statusText) {
    setShowerStatusText(statusText);
    setTimeout(() => hideShowerLoader(), 1200);
  } else {
    hideShowerLoader();
  }
  resetTipShowerTracking();
}

const generateTipShowerContextId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

async function submitTipShowerBatch(
  recipients: TipShowerRecipient[],
  amountPerTip: string,
  tokenSymbol: string,
  contextId?: string,
  useExistingApprovalContext = false
): Promise<boolean> {
  if (recipients.length === 0) {
    return false;
  }
  const tokenConfig = TOKENS_MAP[tokenSymbol];
  if (!tokenConfig) {
    showToast("Unsupported token selected for tip shower.");
    return false;
  }
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    showToast("Extension runtime unavailable. Please reload the extension.");
    return false;
  }

  const resolvedContextId =
    contextId || currentTipShowerContextId || generateTipShowerContextId();
  if (!currentTipShowerContextId) {
    currentTipShowerContextId = resolvedContextId;
  }
  currentTipShowerTotal = recipients.length;
  currentTipShowerMeta = {
    amount: amountPerTip,
    tokenSymbol: tokenSymbol.toUpperCase(),
  };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "QUEUE_TIP_SHOWER",
        payload: {
          recipients,
          amountPerTip,
          tokenSymbol,
          tokenAddress: tokenConfig.address,
          contextId: resolvedContextId,
          useExistingApprovalContext,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showToast(
            `Failed to queue tip shower: ${chrome.runtime.lastError.message}`
          );
          endTipShowerSession("Failed to queue tip shower.");
          resolve(false);
          return;
        }
        if (response?.success) {
          resolve(true);
        } else {
          showToast(response?.error || "Tip shower failed.");
          endTipShowerSession("Tip shower failed.");
          resolve(false);
        }
      }
    );
  });
}

async function startTipShower(count: number, amount: string, token: string) {
  if (isShowerActive) return;
  isShowerActive = true;
  (window as any).isTipShowerActive = true;
  let loaderVisible = false;
  let approvalReserved = false;
  resetTipShowerTracking();
  const normalizedToken = token.toUpperCase();
  const sessionContextId = generateTipShowerContextId();
  currentTipShowerContextId = sessionContextId;
  currentTipShowerMeta = { amount, tokenSymbol: normalizedToken };

  try {
    const walletStatus = await getWalletStatus();
    if (!walletStatus) {
      showToast("Failed to check wallet status. Please try again.");
      return;
    }
    if (!walletStatus.isUnlocked) {
      showToast("Wallet is locked. Please unlock your wallet first.");
      const unlocked = await promptAndWaitForWalletUnlock();
      if (!unlocked) {
        showToast("Wallet unlock was cancelled or timed out.");
        return;
      }
    }

    showShowerLoader();
    loaderVisible = true;
    setShowerStatusText("Awaiting wallet approval...");
    showToast("Approve the tip shower in your wallet to continue.");

    const approvalPromise = waitForTipShowerApproval(sessionContextId);
    const approvalRequested = await requestTipShowerApproval(
      sessionContextId,
      count,
      amount,
      normalizedToken
    );
    if (!approvalRequested) {
      rejectTipShowerApproval(
        sessionContextId,
        "Failed to initiate wallet approval."
      );
    }

    try {
      await approvalPromise;
      approvalReserved = true;
    } catch (approvalError: any) {
      const errorMessage =
        approvalError?.message || "Wallet approval was rejected.";
      showToast(errorMessage);
      endTipShowerSession(errorMessage);
      loaderVisible = false;
      return;
    }

    setShowerStatusText("Finding posts...");
    const { recipients, likeTargets } = await collectTipShowerTargets(
      count,
      sessionContextId
    );

    if (!recipients.length) {
      showToast("No posts found to tip.");
      if (approvalReserved) {
        await cancelTipShowerApproval(sessionContextId, "No posts found.").catch(
          () => undefined
        );
        approvalReserved = false;
      }
      endTipShowerSession("No posts found to tip.");
      loaderVisible = false;
      return;
    }

    currentTipShowerLikeTargets = likeTargets;
    currentTipShowerTotal = recipients.length;
    updateShowerProgress(0, recipients.length);

    const submissionSuccess = await submitTipShowerBatch(
      recipients,
      amount,
      normalizedToken,
      sessionContextId,
      true
    );
    approvalReserved = false;
    if (!submissionSuccess) {
      showToast("Tip shower failed to start. Please try again.");
      endTipShowerSession("Tip shower failed to start.");
      loaderVisible = false;
    }
  } catch (err: any) {
    const fallbackError =
      err?.message || "Tip shower failed. Please try again.";
    showToast(fallbackError);
    if (approvalReserved) {
      await cancelTipShowerApproval(sessionContextId, fallbackError).catch(
        () => undefined
      );
      approvalReserved = false;
    }
    endTipShowerSession(fallbackError);
    loaderVisible = false;
    return;
  } finally {
    isShowerActive = false;
    (window as any).isTipShowerActive = false;
    if (loaderVisible && !currentTipShowerContextId) {
      hideShowerLoader();
      resetTipShowerTracking();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

async function collectTipShowerTargets(
  desiredCount: number,
  sessionContextId: string
): Promise<{
  recipients: TipShowerRecipient[];
  likeTargets: TipShowerLikeTarget[];
}> {
  const recipients: TipShowerRecipient[] = [];
  const likeTargets: TipShowerLikeTarget[] = [];
  let lastHeight = 0;
  let attempts = 0;

  while (recipients.length < desiredCount && attempts < 10) {
    const posts = getTipShowerCandidatePosts();

    for (const post of posts) {
      if (recipients.length >= desiredCount) break;
      const likePath = post.querySelector(LIKE_PATH_SELECTOR) as
        | SVGPathElement
        | null;
      const likeButton = likePath?.closest("button") as HTMLElement | null;
      if (likeButton && !likeButton.getAttribute("data-tipped")) {
        likeButton.setAttribute("data-tipped", "true");
        const target = await collectTipTarget(likeButton);
        if (target) {
          const nextIndex = recipients.length;
          const likeId = `${sessionContextId}-${nextIndex}`;
          likeButton.setAttribute("data-arex-like-id", likeId);
          recipients.push(target);
          likeTargets.push({ handle: target.handle, button: likeButton, likeId });
          currentTipShowerTotal = recipients.length;
          setShowerStatusText(
            `Finding posts... (${recipients.length} / ${desiredCount})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (document.body.scrollHeight === lastHeight) {
      attempts++;
    } else {
      lastHeight = document.body.scrollHeight;
      attempts = 0;
    }
  }

  return { recipients, likeTargets };
}

function getTipShowerCandidatePosts(): HTMLElement[] {
  return Array.from(document.querySelectorAll(POST_SELECTOR)).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.classList.contains("cursor-pointer")
  );
}

async function collectTipTarget(
  button: HTMLElement
): Promise<TipShowerRecipient | null> {
  const post =
    button.closest<HTMLElement>(`${POST_SELECTOR}.cursor-pointer`) ||
    button.closest<HTMLElement>(POST_SELECTOR);
  if (!post) return null;

  const anchorEls = post.querySelectorAll("a.truncate");
  let handle: string | null = null;
  for (const el of Array.from(anchorEls)) {
    const text = el.textContent?.trim();
    if (text?.startsWith("@")) {
      handle = text.slice(1);
      break;
    }
  }
  if (!handle) return null;

  try {
    const res = await fetch(
      `https://api.starsarena.com/user/handle?handle=${encodeURIComponent(
        handle
      )}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const address = data?.user?.address;
    if (!address) return null;
    return { handle, address };
  } catch (e) {
    console.error("Tip target collection failed", e);
    return null;
  }
}

function syncTipShowerLikes(processedCount: number) {
  if (!currentTipShowerLikeTargets.length) return;
  while (
    currentTipShowerLastLikedIndex < processedCount &&
    currentTipShowerLastLikedIndex < currentTipShowerLikeTargets.length
  ) {
    const target =
      currentTipShowerLikeTargets[currentTipShowerLastLikedIndex];
    if (!target) break;
    const button =
      (target.button && target.button.isConnected
        ? target.button
        : findLikeButtonForTarget(target)) || null;
    if (button) {
      simulateLikeClick(button);
      target.button = button;
    }
    showTipResultToast(target.handle);
    currentTipShowerLastLikedIndex += 1;
  }
}

function findLikeButtonForTarget(target: TipShowerLikeTarget): HTMLElement | null {
  if (target.likeId) {
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(target.likeId)
        : target.likeId.replace(/"/g, '\\"');
    const byId = document.querySelector<HTMLElement>(
      `[data-arex-like-id="${escaped}"]`
    );
    if (byId) {
      return byId;
    }
  }
  const normalized = target.handle.toLowerCase();
  const posts = getTipShowerCandidatePosts();
  for (const post of posts) {
    const anchors = post.querySelectorAll("a.truncate");
    for (const anchor of Array.from(anchors)) {
      const text = anchor.textContent?.trim().toLowerCase();
      if (text === `@${normalized}`) {
        const likePath = post.querySelector(
          "button svg path[d^='M352.92 80']"
        ) as SVGPathElement | null;
        const likeButton = likePath?.closest("button") as HTMLElement | null;
        if (likeButton) {
          return likeButton;
        }
      }
    }
  }
  return null;
}

function simulateLikeClick(button: HTMLElement) {
  try {
    const eventOptions: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
    };
    if (typeof PointerEvent !== "undefined") {
      button.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
      button.dispatchEvent(new PointerEvent("pointerup", eventOptions));
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    button.setAttribute("data-arex-liked", "1");
  } catch {
    try {
      button.click();
    } catch (err) {
      console.warn("[AREX] Failed to trigger like button", err);
    }
  }
}

function showTipResultToast(handle: string) {
  if (!currentTipShowerMeta) return;
  const displayHandle = handle ? `@${handle}` : "this user";
  showToast(
    `Tipped ${currentTipShowerMeta.amount} ${currentTipShowerMeta.tokenSymbol} to ${displayHandle}`
  );
}

export function initTipShower() {
  registerTipShowerProgressListener();
  chrome.runtime.onMessage.addListener(tipShowerListener);

  const observer = new MutationObserver(() => {
    injectProfileTipShowerButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  injectProfileTipShowerButton();
}

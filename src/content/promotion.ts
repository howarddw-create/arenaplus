import { showToast } from "../utils/toast";
import {
  createPromotion,
  fetchTextViaBackground,
  getBearerToken,
  fetchPromotionsFiltered,
  fetchMyPromotions,
  cancelPromotionTx,
  getRewardTokenMetadata,
  getActiveSubscribedTokens,
} from "../services/post2earnService";
import {
  getWalletStatus,
  promptAndWaitForWalletUnlock,
} from "../utils/walletPrompt";
import { ethers } from "ethers";
import { ARENA_TOKEN_ADDRESS, ARENA_TOKEN_DECIMALS } from "../utils/arenaToken";
import {
  cancelCreatePromotionApproval,
  failCreatePromotionApproval,
  generateCreatePromotionContextId,
  registerCreatePromotionApprovalListener,
  requestCreatePromotionApproval,
  waitForCreatePromotionApproval,
} from "./promotionFeature/approval";
import { callEngageBackend } from "./promotionFeature/engage";
import {
  FALLBACK_AUTH_TOKEN,
  ensureModalStyles,
  ensureShimmerStyles,
  ensureSpinnerKeyframes,
  normalizeAuthToken,
} from "./promotionFeature/ui";

const logError = (...args: any[]) => {
  console.error("[Nester]", ...args);
};

// ARENA token constants imported from utils/arenaToken

// Promotion type color schemes
const PROMOTION_TYPE_STYLES: Record<
  number,
  { badgeGradient: string; badgeBorder: string; buttonGradient: string }
> = {
  0: {
    // Comment
    badgeGradient: "linear-gradient(90deg, #f97316, #ea580c)",
    badgeBorder: "rgba(234,88,12,.35)",
    buttonGradient: "linear-gradient(90deg, #f97316, #ea580c)",
  },
  1: {
    // Repost
    badgeGradient: "linear-gradient(90deg, #059669, #047857)",
    badgeBorder: "rgba(5,150,105,.35)",
    buttonGradient: "linear-gradient(90deg, #059669, #047857)",
  },
  2: {
    // Quote
    badgeGradient: "linear-gradient(90deg, #a855f7, #7c3aed)",
    badgeBorder: "rgba(168,85,247,.35)",
    buttonGradient: "linear-gradient(90deg, #a855f7, #7c3aed)",
  },
};

const DEFAULT_PROMOTION_STYLE = {
  badgeGradient: "linear-gradient(90deg, #64748b, #475569)",
  badgeBorder: "rgba(100,116,139,.35)",
  buttonGradient: "linear-gradient(90deg, #64748b, #475569)",
};

let observer: MutationObserver | null = null;

function createShimmerBlock(
  width: string,
  height: string,
  borderRadius = 8
): HTMLDivElement {
  ensureShimmerStyles();
  const block = document.createElement("div");
  block.style.cssText = [
    `width:${width}`,
    `height:${height}`,
    `border-radius:${borderRadius}px`,
    "background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.18), rgba(255,255,255,.06))",
    "background-size:200px 100%",
    "animation:arex-shimmer 1.25s infinite",
  ].join(";");
  return block;
}

function createShimmerCard(): HTMLDivElement {
  const card = document.createElement("div");
  card.dataset.arexShimmer = "true";
  card.style.cssText = [
    "border:1px solid rgba(148,163,184,.15)",
    "border-radius:14px",
    "padding:14px",
    "background:linear-gradient(180deg, rgba(17,17,20,.55), rgba(12,12,15,.5))",
    "display:flex",
    "flex-direction:column",
    "gap:14px",
  ].join(";");

  const headerRow = document.createElement("div");
  headerRow.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;";
  const headerLeft = document.createElement("div");
  headerLeft.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;align-items:center;";
  headerLeft.appendChild(createShimmerBlock("70px", "20px", 999));
  headerLeft.appendChild(createShimmerBlock("110px", "24px", 999));
  headerLeft.appendChild(createShimmerBlock("120px", "24px", 999));
  headerLeft.appendChild(createShimmerBlock("140px", "24px", 999));
  headerRow.appendChild(headerLeft);
  headerRow.appendChild(createShimmerBlock("36px", "14px", 999));
  card.appendChild(headerRow);

  const body = document.createElement("div");
  body.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;";

  const preview = document.createElement("div");
  preview.style.cssText =
    "padding:12px;background:rgba(0,0,0,.25);border-radius:10px;border:1px solid rgba(148,163,184,.15);display:flex;flex-direction:column;gap:10px;";
  preview.appendChild(createShimmerBlock("100px", "12px", 6));
  const profileRow = document.createElement("div");
  profileRow.style.cssText =
    "display:flex;align-items:center;gap:10px;";
  profileRow.appendChild(createShimmerBlock("40px", "40px", 20));
  const profileText = document.createElement("div");
  profileText.style.cssText = "flex:1;display:flex;flex-direction:column;gap:6px;";
  profileText.appendChild(createShimmerBlock("70%", "10px", 6));
  profileText.appendChild(createShimmerBlock("50%", "8px", 6));
  profileRow.appendChild(profileText);
  preview.appendChild(profileRow);
  preview.appendChild(createShimmerBlock("100%", "10px", 6));
  preview.appendChild(createShimmerBlock("90%", "10px", 6));
  preview.appendChild(createShimmerBlock("95%", "10px", 6));
  preview.appendChild(createShimmerBlock("100%", "80px", 10));

  const summary = document.createElement("div");
  summary.style.cssText =
    "padding:12px;background:rgba(0,0,0,.25);border-radius:10px;border:1px solid rgba(148,163,184,.15);display:flex;flex-direction:column;gap:10px;";
  summary.appendChild(createShimmerBlock("120px", "12px", 6));
  for (let i = 0; i < 5; i += 1) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;";
    row.appendChild(createShimmerBlock("35%", "10px", 6));
    row.appendChild(createShimmerBlock("25%", "10px", 6));
    summary.appendChild(row);
  }
  summary.appendChild(createShimmerBlock("100%", "10px", 6));
  summary.appendChild(createShimmerBlock("100%", "6px", 999));

  body.appendChild(preview);
  body.appendChild(summary);
  card.appendChild(body);

  const action = document.createElement("div");
  action.style.cssText =
    "display:flex;flex-direction:column;gap:10px;";
  action.appendChild(createShimmerBlock("100%", "38px", 8));
  action.appendChild(createShimmerBlock("180px", "12px", 6));
  card.appendChild(action);

  return card;
}
function createSpinner(size = 36) {
  ensureSpinnerKeyframes();
  const spinner = document.createElement("div");
  spinner.style.width = `${size}px`;
  spinner.style.height = `${size}px`;
  spinner.style.borderRadius = "50%";
  spinner.style.border = "4px solid rgba(255,255,255,.15)";
  spinner.style.borderTopColor = "#f97316";
  spinner.style.animation = "arex-spin 0.9s linear infinite";
  return spinner;
}

function isArenaSite() {
  return window.location.href.includes("arena.social");
}

function isTargetMenu(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  // Heuristic: Radix popper containers often have ids starting with "radix-"
  // and this menu contains known items like Copy link / Report Post
  const container = (
    el.matches('[id^="radix-"], [data-radix-popper-content-wrapper]')
      ? el
      : el.querySelector('[id^="radix-"], [data-radix-popper-content-wrapper]')
  ) as HTMLElement | null;
  if (!container) return false;

  const text = container.textContent || "";
  const looksLikePostMenu =
    /Copy link|Copy Text|Report Post|Post Reactions/i.test(text);
  return looksLikePostMenu;
}

// Detect the left sidebar "More" dropdown (Radix menu) by its characteristic entries
function isMoreMenu(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const container = (
    el.matches('[id^="radix-"], [data-radix-popper-content-wrapper]')
      ? el
      : el.querySelector('[id^="radix-"], [data-radix-popper-content-wrapper]')
  ) as HTMLElement | null;
  if (!container) return false;
  const text = (container.textContent || "").trim();
  // Match against known items in the More menu (subject to minor text changes)
  const looksLikeMore =
    /Arena Launch|Refer & Earn|Bookmarks|Arena App Store|Settings & Support|ArenaTrade|Log out|\$ARENA Tokenomics/i.test(
      text
    );
  // Avoid confusing with post menu
  if (/Copy link|Report Post|Post Reactions/i.test(text)) return false;
  return looksLikeMore;
}

// Try to extract postId from an anchor inside the Radix menu container.
function extractPostIdFromMenu(menu: HTMLElement): string | null {
  const container =
    (menu.closest(
      '[id^="radix-"], [data-radix-popper-content-wrapper]'
    ) as HTMLElement | null) || menu;
  const link = container.querySelector(
    'a[href*="/status/"], a[href*="/nested/"]'
  ) as HTMLAnchorElement | null;
  return extractIdFromRef(link?.href || "");
}

// Extract just the trailing post identifier from a URL or string.
function extractIdFromRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    const s = String(ref);
    const m =
      s.match(/(?:status|nested)\/([^/?#]+)/i) || s.match(/\/([^/?#]+)$/);
    return m && m[1] ? m[1] : null;
  }
}

// Try to extract the full post link (preferred) directly from anchors inside the menu.
function extractPostLinkFromMenu(menu: HTMLElement): string | null {
  const container =
    (menu.closest(
      '[id^="radix-"], [data-radix-popper-content-wrapper]'
    ) as HTMLElement | null) || menu;
  // Common: an <a> with the post URL exists somewhere (e.g., inside Copy link)
  const linkEl = container.querySelector(
    'a[href*="/status/"], a[href*="/nested/"]'
  ) as HTMLAnchorElement | null;
  if (linkEl?.href) return linkEl.href;

  // Some implementations store the link on the Copy link item attributes
  const copyItem = Array.from(container.querySelectorAll("*")).find((n) =>
    /Copy link/i.test(((n as HTMLElement).textContent || "").trim())
  ) as HTMLElement | undefined;
  if (copyItem) {
    // Look for a descendant anchor or data attribute commonly used by clipboard libs
    const innerA = copyItem.querySelector(
      'a[href*="/status/"]'
    ) as HTMLAnchorElement | null;
    if (innerA?.href) return innerA.href;
    const dataHref = (copyItem as HTMLElement).getAttribute(
      "data-clipboard-text"
    );
    if (dataHref) return dataHref;
  }
  return null;
}

function decodePromotionContent(value: string): string {
  if (!value) return "";
  const looksLikeHtml = /<[^>]+>/.test(value);

  if (looksLikeHtml) {
    const div = document.createElement("div");
    div.innerHTML = value;
    return (div.textContent || div.innerText || "").trim();
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value.trim();
}

function parsePromotionContentPayload(raw: string | null | undefined): string {
  if (!raw) return "";
  let candidate = String(raw);

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && "content" in parsed) {
      candidate = String((parsed as any).content ?? "");
    }
  } catch { }

  return decodePromotionContent(candidate);
}

async function resolvePromotionContent(promotion: any): Promise<string | null> {
  if (promotion?.contentURI) {
    try {
      const remote = await fetchTextViaBackground(
        promotion.contentURI as string
      );
      const parsedRemote = parsePromotionContentPayload(remote);
      if (parsedRemote) {
        return parsedRemote;
      }
    } catch (err) {
      console.warn(
        "[AREX] Failed to resolve promotion contentURI for preview",
        err
      );
    }
  }

  const fallback = parsePromotionContentPayload(promotion?.content);
  return fallback || null;
}

// As a last resort, simulate clicking "Copy link" and then read from clipboard.
async function getPostLinkViaClipboard(
  menu: HTMLElement
): Promise<string | null> {
  try {
    const container =
      (menu.closest(
        '[id^="radix-"], [data-radix-popper-content-wrapper]'
      ) as HTMLElement | null) || menu;
    const copyItem = Array.from(container.querySelectorAll("*")).find((n) =>
      /Copy link/i.test(((n as HTMLElement).textContent || "").trim())
    ) as HTMLElement | undefined;
    if (!copyItem) return null;

    // Trigger the site's logic to write to clipboard
    (copyItem as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );

    // Give it a moment to write, then try readText (requires user gesture; we are in a click handler)
    await new Promise((r) => setTimeout(r, 50));
    if (navigator.clipboard && navigator.clipboard.readText) {
      const txt = await navigator.clipboard.readText();
      if (/^https?:\/\/.*arena\.social\//i.test(txt)) return txt;
    }
  } catch (e) {
    console.warn("[AREX] Clipboard read failed (non-fatal):", e);
  }
  return null;
}

function closePromotionModal() {
  const overlay = document.getElementById(
    "arex-promo-overlay"
  ) as HTMLElement | null;
  if (overlay) {
    const onKey = (overlay as any)._arexOnKey as
      | ((ev: KeyboardEvent) => void)
      | undefined;
    if (onKey) document.removeEventListener("keydown", onKey);
    overlay.remove();
  }
}

// ----- Show Promotions modal helpers -----
function closePromotionsListModal() {
  const overlay = document.getElementById(
    "arex-promos-overlay"
  ) as HTMLElement | null;
  if (overlay) {
    const onKey = (overlay as any)._arexOnKey as
      | ((ev: KeyboardEvent) => void)
      | undefined;
    if (onKey) document.removeEventListener("keydown", onKey);
    const sortCleanup = (overlay as any)._arexSortCleanup as
      | (() => void)
      | undefined;
    if (sortCleanup) sortCleanup();
    const filterCleanup = (overlay as any)._arexFilterCleanup as
      | (() => void)
      | undefined;
    if (filterCleanup) filterCleanup();
    const timers = (overlay as any)._arexCountdowns as number[] | undefined;
    if (timers && Array.isArray(timers)) {
      timers.forEach((id) => clearInterval(id));
    }
    overlay.remove();
  }
}

function formatUnitsStr(weiStr: string, decimals = 18): string {
  try {
    const neg = weiStr.startsWith("-");
    const s = neg ? weiStr.slice(1) : weiStr;
    const big = BigInt(s);
    const base = 10n ** BigInt(decimals);
    const intPart = big / base;
    const fracPart = big % base;
    let fracStr = fracPart.toString().padStart(decimals, "0");
    // trim trailing zeros and clamp to 6 decimals for UI brevity
    fracStr = fracStr.replace(/0+$/, "").slice(0, 6);
    return `${neg ? "-" : ""}${intPart.toString()}${fracStr ? "." + fracStr : ""
      }`;
  } catch {
    return weiStr;
  }
}

function formatTimeRemaining(msLeft: number): string {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return "Expired";

  const totalSeconds = Math.floor(msLeft / 1000);
  const units = [
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  const parts: string[] = [];
  let remaining = totalSeconds;

  for (const unit of units) {
    if (parts.length === 2) break;

    const value = Math.floor(remaining / unit.seconds);
    if (value <= 0) {
      if (unit.label === "second" && parts.length === 0) {
        parts.push("less than 1 minute left");
        break;
      }
      continue;
    }

    const label = `${value} ${unit.label}${value === 1 ? "" : "s"}`;
    parts.push(label);
    remaining -= value * unit.seconds;
  }

  if (parts.length === 0) return "less than 1 minute left";
  return `${parts.join(" ")} left`;
}

function promotionTypeLabel(t: number): string {
  // Solidity enum PromotionType { Comment(0), Repost(1), Quote(2) }
  return t === 1 ? "Repost" : t === 2 ? "Quote" : "Comment";
}

function getArenaUserId(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ph_phc_")) {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed && parsed.userId) {
            return parsed.userId;
          }
        }
      }
    }
  } catch (error) {
    console.error("[Nester] Error reading userId from localStorage:", error);
  }
  return null;
}

async function fetchPostContent(postId: string): Promise<any> {
  let authToken = "";
  try {
    authToken = await getBearerToken();
  } catch (err) {
    console.warn("[AREX] Unable to retrieve bearer token from background", err);
    authToken = FALLBACK_AUTH_TOKEN;
  }

  if (!authToken) {
    console.warn("[AREX] No bearer token available for post fetch");
  }
  console.log("[AREX] Fetching post content for postId:", postId);
  console.log(
    "[AREX] API URL:",
    `https://api.starsarena.com/threads/nested?threadId=${postId}`
  );

  try {
    const response = await fetch(
      `https://api.starsarena.com/threads/nested?threadId=${postId}`,
      {
        headers: authToken
          ? { Authorization: authToken }
          : { Accept: "application/json" },
      }
    );

    console.log("[AREX] Response status:", response.status);
    console.log(
      "[AREX] Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AREX] HTTP Error Response:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("[AREX] Full API Response:", data);

    // Extract thread data from threads array
    const threadData =
      data.threads && data.threads.length > 0 ? data.threads[0] : null;
    console.log("[AREX] Extracted thread data:", threadData);

    return threadData;
  } catch (error) {
    console.error("[AREX] Failed to fetch post content:", error);
    return null;
  }
}

export async function openPromotionsListModal() {
  // Remove any existing modal
  const existing = document.getElementById("arex-promos-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "arex-promos-overlay";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "background:rgba(0,0,0,.65)",
    "backdrop-filter:blur(10px)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePromotionsListModal();
  });

  ensureModalStyles();
  const modal = document.createElement("div");
  modal.id = "arex-promos-modal";
  modal.className = "arex-modal";
  // Inline styles that might override class styles or are specific
  modal.style.position = "relative";

  // Header
  const header = document.createElement("div");
  header.className = "arex-modal-header";
  header.style.paddingRight = "4px";
  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.setAttribute("aria-label", "Refresh");
  refreshBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#e2e8f0;cursor:pointer;transition:all .2s ease;";
  refreshBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>';
  refreshBtn.addEventListener("mouseenter", () => {
    refreshBtn.style.background = "rgba(255,255,255,.12)";
  });
  refreshBtn.addEventListener("mouseleave", () => {
    refreshBtn.style.background = "rgba(255,255,255,.06)";
  });

  type SortOptionKey = "latest" | "oldest" | "reward";
  const sortOptions: Array<{ key: SortOptionKey; label: string }> = [
    { key: "latest", label: "Latest" },
    { key: "oldest", label: "Oldest" },
    { key: "reward", label: "Highest reward" },
  ];
  type MyFilterKey =
    | "all"
    | "cancelAvailable"
    | "expiredWithUnusedVault"
    | "vaultClaimed";
  const myFilterOptions: Array<{
    key: MyFilterKey;
    label: string;
    helper?: string;
  }> = [
      { key: "all", label: "All" },
      { key: "cancelAvailable", label: "Active & cancelable", helper: "Running promos you can cancel" },
      { key: "expiredWithUnusedVault", label: "Expired with unused vault", helper: "Expired promos that still have funds" },
      { key: "vaultClaimed", label: "Vault claimed", helper: "Ended promos where vault was reclaimed" },
    ];
  let currentSortKey: SortOptionKey = "reward";
  let currentMyFilter: MyFilterKey = "all";
  let sortMenuOpen = false;
  type PromotionsTab = "active" | "mine";
  let currentTab: PromotionsTab = "active";
  let ignoreFollowerFilter = false;
  const tabCounts: Record<PromotionsTab, number> = {
    active: 0,
    mine: 0,
  };
  const tabButtons: Partial<Record<PromotionsTab, HTMLButtonElement>> = {};
  const tabCountLabels: Partial<Record<PromotionsTab, HTMLSpanElement>> = {};
  let walletAddress: string | null = null;
  let walletFetchPromise: Promise<string | null> | null = null;

  const requestWalletAddress = (): Promise<string | null> =>
    new Promise((resolve) => {
      const resolveFromStorage = () => {
        try {
          chrome.storage.local.get(["walletData"], (result) => {
            resolve(result?.walletData?.address || null);
          });
        } catch (storageErr) {
          console.warn("[AREX] Failed to read walletData", storageErr);
          resolve(null);
        }
      };
      try {
        chrome.runtime.sendMessage({ type: "GET_APP_STATE" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[AREX] Failed to fetch wallet address",
              chrome.runtime.lastError.message
            );
            resolveFromStorage();
            return;
          }
          if (response?.wallet?.address) {
            resolve(response.wallet.address);
            return;
          }
          resolveFromStorage();
        });
      } catch (err) {
        console.warn("[AREX] Unexpected error fetching wallet address", err);
        resolveFromStorage();
      }
    });

  const ensureWalletAddress = async (): Promise<string | null> => {
    if (walletAddress) return walletAddress;
    if (!walletFetchPromise) {
      walletFetchPromise = requestWalletAddress().then((addr) => {
        walletAddress = addr;
        walletFetchPromise = null;
        return addr;
      });
    }
    return walletFetchPromise;
  };

  const updateTabCount = (tab: PromotionsTab, count: number) => {
    tabCounts[tab] = count;
    const label = tabCountLabels[tab];
    if (label) {
      label.textContent = `(${count})`;
    }
  };

  const updateTabVisualState = () => {
    (["active", "mine"] as PromotionsTab[]).forEach((tabKey) => {
      const btn = tabButtons[tabKey];
      if (!btn) return;
      const isActive = currentTab === tabKey;
      btn.style.background = isActive
        ? "linear-gradient(120deg, #f97316, #fb923c)"
        : "transparent";
      btn.style.color = isActive ? "#0b0d12" : "#e2e8f0";
      btn.style.boxShadow = "none";
      btn.style.borderColor = isActive
        ? "rgba(249,115,22,.65)"
        : "transparent";
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const sortWrap = document.createElement("div");
  sortWrap.style.cssText = "position:relative;";

  const sortButton = document.createElement("button");
  sortButton.type = "button";
  sortButton.setAttribute("aria-haspopup", "menu");
  sortButton.setAttribute("aria-expanded", "false");
  sortButton.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:32px",
    "height:32px",
    "background:rgba(15,17,22,.92)",
    "color:#f8fafc",
    "border:1px solid rgba(148,163,184,.32)",
    "border-radius:999px",
    "cursor:pointer",
    "transition:background .2s ease,border-color .2s ease",
  ].join(";");
  // Tooltip
  sortButton.title = "Sort";

  // Label removed for icon-only style
  const updateSortButtonLabel = () => {
    // No-op for icon button, but we could update tooltip
    const active = sortOptions.find((opt) => opt.key === currentSortKey);
    sortButton.title = active ? `Sort: ${active.label}` : "Sort";
  };
  updateSortButtonLabel();

  const sortIcon = document.createElement("span");
  sortIcon.innerHTML =
    '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>';
  sortIcon.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:14px;height:14px;transition:transform .2s ease;";
  sortButton.appendChild(sortIcon);

  sortWrap.appendChild(sortButton);

  const sortMenu = document.createElement("div");
  sortMenu.setAttribute("role", "menu");
  sortMenu.style.cssText = [
    "position:absolute",
    "top:calc(100% + 8px)",
    "right:0",
    "width:190px",
    "background:rgba(17,19,25,.98)",
    "border:1px solid rgba(148,163,184,.35)",
    "border-radius:14px",
    "padding:6px",
    "display:flex",
    "flex-direction:column",
    "gap:4px",
    "box-shadow:0 18px 40px rgba(0,0,0,.45)",
    "backdrop-filter:blur(12px)",
    "z-index:2147483647",
  ].join(";");
  sortMenu.style.display = "none";
  sortMenu.addEventListener("mousedown", (ev) => ev.stopPropagation());
  sortWrap.appendChild(sortMenu);

  const optionButtons: HTMLButtonElement[] = [];
  const setOptionVisualState = (button: HTMLButtonElement, active: boolean) => {
    button.style.background = active ? "rgba(255,255,255,.09)" : "transparent";
    button.style.color = active ? "#f8fafc" : "#e2e8f0";
    button.setAttribute("aria-checked", active ? "true" : "false");
    const check = button.querySelector<HTMLElement>("[data-check-icon]");
    if (check) {
      check.style.opacity = active ? "1" : "0";
    }
  };
  const updateOptionStates = () => {
    optionButtons.forEach((btn) => {
      const key = btn.dataset.sortKey as SortOptionKey;
      setOptionVisualState(btn, key === currentSortKey);
    });
  };

  sortOptions.forEach((opt) => {
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.dataset.sortKey = opt.key;
    optBtn.setAttribute("role", "menuitemradio");
    optBtn.setAttribute("aria-checked", "false");
    optBtn.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:10px",
      "width:100%",
      "padding:8px 10px",
      "background:transparent",
      "border:none",
      "color:#e2e8f0",
      "border-radius:10px",
      "font-size:13px",
      "font-weight:500",
      "cursor:pointer",
      "transition:background .15s ease,color .15s ease",
    ].join(";");
    const labelSpan = document.createElement("span");
    labelSpan.textContent = opt.label;
    labelSpan.style.cssText = "flex:1;text-align:left;";
    optBtn.appendChild(labelSpan);

    const checkSpan = document.createElement("span");
    checkSpan.dataset.checkIcon = "true";
    checkSpan.innerHTML =
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8.143 14.314a1 1 0 01-.707-.293l-3.45-3.45a1 1 0 111.414-1.414l2.743 2.743 5.457-5.457a1 1 0 111.414 1.414l-6.164 6.164a1 1 0 01-.707.293z"/></svg>';
    checkSpan.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:#f8fafc;opacity:0;transition:opacity .15s ease;";
    optBtn.appendChild(checkSpan);

    optBtn.addEventListener("mouseenter", () => {
      if (opt.key !== currentSortKey) {
        optBtn.style.background = "rgba(255,255,255,.06)";
      }
    });
    optBtn.addEventListener("mouseleave", () => {
      const active = opt.key === currentSortKey;
      optBtn.style.background = active ? "rgba(255,255,255,.09)" : "transparent";
    });
    optBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const previous = currentSortKey;
      currentSortKey = opt.key;
      updateSortButtonLabel();
      updateOptionStates();
      if (previous !== currentSortKey) {
        loadAndRender(true);
      }
      closeSortMenu();
    });

    optionButtons.push(optBtn);
    sortMenu.appendChild(optBtn);
  });
  updateOptionStates();

  const onSortDocClick = (e: MouseEvent) => {
    if (!sortWrap.contains(e.target as Node)) {
      closeSortMenu();
    }
  };
  const onSortDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeSortMenu({ restoreFocus: true });
    }
  };
  const attachSortMenuListeners = () => {
    document.addEventListener("mousedown", onSortDocClick);
    document.addEventListener("keydown", onSortDocKeyDown);
  };
  const detachSortMenuListeners = () => {
    document.removeEventListener("mousedown", onSortDocClick);
    document.removeEventListener("keydown", onSortDocKeyDown);
  };
  const setSortButtonExpanded = (expanded: boolean) => {
    sortButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    sortButton.style.background = expanded
      ? "rgba(24,28,36,.96)"
      : "rgba(15,17,22,.92)";
    sortButton.style.borderColor = expanded
      ? "rgba(148,163,184,.45)"
      : "rgba(148,163,184,.32)";
    sortIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
  };
  const openSortMenu = () => {
    if (sortMenuOpen) return;
    sortMenuOpen = true;
    sortMenu.style.display = "flex";
    setSortButtonExpanded(true);
    attachSortMenuListeners();
  };
  const closeSortMenu = ({
    restoreFocus = false,
    force = false,
  }: { restoreFocus?: boolean; force?: boolean } = {}) => {
    if (!sortMenuOpen && !force) {
      return;
    }
    sortMenuOpen = false;
    sortMenu.style.display = "none";
    setSortButtonExpanded(false);
    detachSortMenuListeners();
    if (restoreFocus) {
      sortButton.focus();
    }
  };

  (overlay as any)._arexSortCleanup = () => closeSortMenu({ force: true });

  sortButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (sortMenuOpen) {
      closeSortMenu();
    } else {
      openSortMenu();
    }
  });
  sortButton.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " " || ev.key === "ArrowDown") {
      ev.preventDefault();
      if (!sortMenuOpen) {
        openSortMenu();
      }
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      closeSortMenu({ restoreFocus: false });
    }
  });

  const myFilterWrap = document.createElement("div");
  myFilterWrap.style.cssText = "position:relative;display:none;";
  const myFilterButton = document.createElement("button");
  myFilterButton.type = "button";
  myFilterButton.setAttribute("aria-haspopup", "menu");
  myFilterButton.setAttribute("aria-expanded", "false");
  myFilterButton.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:32px",
    "height:32px",
    "background:rgba(15,17,22,.92)",
    "color:#f8fafc",
    "border:1px solid rgba(148,163,184,.32)",
    "border-radius:999px",
    "cursor:pointer",
    "transition:background .2s ease,border-color .2s ease",
  ].join(";");
  // Tooltip
  myFilterButton.title = "Filter";
  // Label removed for icon-only style
  const updateMyFilterLabel = () => {
    const active = myFilterOptions.find((opt) => opt.key === currentMyFilter);
    myFilterButton.title = active ? `Filter: ${active.label}` : "Filter";
  };
  updateMyFilterLabel();
  const myFilterIcon = document.createElement("span");
  myFilterIcon.innerHTML =
    '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>';
  myFilterIcon.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:14px;height:14px;transition:transform .2s ease;";
  myFilterButton.appendChild(myFilterIcon);
  myFilterWrap.appendChild(myFilterButton);

  const myFilterMenu = document.createElement("div");
  myFilterMenu.setAttribute("role", "menu");
  myFilterMenu.style.cssText = [
    "position:absolute",
    "top:calc(100% + 8px)",
    "right:0",
    "width:240px",
    "background:rgba(17,19,25,.98)",
    "border:1px solid rgba(148,163,184,.35)",
    "border-radius:14px",
    "padding:6px",
    "display:flex",
    "flex-direction:column",
    "gap:4px",
    "box-shadow:0 18px 40px rgba(0,0,0,.45)",
    "backdrop-filter:blur(12px)",
    "z-index:2147483647",
  ].join(";");
  myFilterMenu.style.display = "none";
  myFilterMenu.addEventListener("mousedown", (ev) => ev.stopPropagation());
  myFilterWrap.appendChild(myFilterMenu);

  let myFilterMenuOpen = false;
  const filterButtons: HTMLButtonElement[] = [];
  const setFilterButtonState = (button: HTMLButtonElement, active: boolean) => {
    button.style.background = active ? "rgba(255,255,255,.09)" : "transparent";
    button.style.color = active ? "#f8fafc" : "#e2e8f0";
    button.setAttribute("aria-checked", active ? "true" : "false");
    const check = button.querySelector<HTMLElement>("[data-check-icon]");
    if (check) {
      check.style.opacity = active ? "1" : "0";
    }
  };
  const updateFilterStates = () => {
    filterButtons.forEach((btn) => {
      const key = btn.dataset.filterKey as MyFilterKey;
      setFilterButtonState(btn, key === currentMyFilter);
    });
  };

  myFilterOptions.forEach((opt) => {
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.dataset.filterKey = opt.key;
    optBtn.setAttribute("role", "menuitemradio");
    optBtn.setAttribute("aria-checked", "false");
    optBtn.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:10px",
      "width:100%",
      "padding:6px 10px",
      "background:transparent",
      "border:none",
      "color:#e2e8f0",
      "border-radius:10px",
      "font-size:13px",
      "font-weight:500",
      "cursor:pointer",
      "transition:background .15s ease,color .15s ease",
      "text-align:left",
    ].join(";");
    const labelWrap = document.createElement("div");
    labelWrap.style.cssText = "display:flex;flex-direction:column;gap:2px;";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = opt.label;
    labelSpan.style.cssText = "font-size:12px;";
    labelWrap.appendChild(labelSpan);
    optBtn.appendChild(labelWrap);

    const checkSpan = document.createElement("span");
    checkSpan.dataset.checkIcon = "true";
    checkSpan.innerHTML =
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8.143 14.314a1 1 0 01-.707-.293l-3.45-3.45a1 1 0 111.414-1.414l2.743 2.743 5.457-5.457a1 1 0 111.414 1.414l-6.164 6.164a1 1 0 01-.707.293z"/></svg>';
    checkSpan.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:#f8fafc;opacity:0;transition:opacity .15s ease;margin-top:2px;";
    optBtn.appendChild(checkSpan);

    optBtn.addEventListener("mouseenter", () => {
      if (opt.key !== currentMyFilter) {
        optBtn.style.background = "rgba(255,255,255,.06)";
      }
    });
    optBtn.addEventListener("mouseleave", () => {
      const active = opt.key === currentMyFilter;
      optBtn.style.background = active ? "rgba(255,255,255,.09)" : "transparent";
    });
    optBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const previous = currentMyFilter;
      currentMyFilter = opt.key;
      updateMyFilterLabel();
      updateFilterStates();
      if (previous !== currentMyFilter) {
        loadAndRender(true);
      }
      closeMyFilterMenu();
    });

    filterButtons.push(optBtn);
    myFilterMenu.appendChild(optBtn);
  });
  updateFilterStates();

  const onFilterDocClick = (e: MouseEvent) => {
    if (!myFilterWrap.contains(e.target as Node)) {
      closeMyFilterMenu();
    }
  };
  const onFilterDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeMyFilterMenu({ restoreFocus: true });
    }
  };
  const attachFilterMenuListeners = () => {
    document.addEventListener("mousedown", onFilterDocClick);
    document.addEventListener("keydown", onFilterDocKeyDown);
  };
  const detachFilterMenuListeners = () => {
    document.removeEventListener("mousedown", onFilterDocClick);
    document.removeEventListener("keydown", onFilterDocKeyDown);
  };
  const setMyFilterExpanded = (expanded: boolean) => {
    myFilterButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    myFilterButton.style.background = expanded
      ? "rgba(24,28,36,.96)"
      : "rgba(15,17,22,.92)";
    myFilterButton.style.borderColor = expanded
      ? "rgba(148,163,184,.45)"
      : "rgba(148,163,184,.32)";
    myFilterIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
  };
  const openMyFilterMenu = () => {
    if (myFilterMenuOpen || currentTab !== "mine") return;
    myFilterMenuOpen = true;
    myFilterMenu.style.display = "flex";
    setMyFilterExpanded(true);
    attachFilterMenuListeners();
  };
  const closeMyFilterMenu = ({
    restoreFocus = false,
    force = false,
  }: { restoreFocus?: boolean; force?: boolean } = {}) => {
    if (!myFilterMenuOpen && !force) {
      return;
    }
    myFilterMenuOpen = false;
    myFilterMenu.style.display = "none";
    setMyFilterExpanded(false);
    detachFilterMenuListeners();
    if (restoreFocus) {
      myFilterButton.focus();
    }
  };

  (overlay as any)._arexFilterCleanup = () => closeMyFilterMenu({ force: true });

  const fetchAllTabCounts = async () => {
    // Fetch active promotions count
    try {
      const activePromos = await fetchPromotionsFiltered({ sortKey: 'latest', offset: 0, limit: 100 }); // Fetch a larger number for an accurate count
      if (Array.isArray(activePromos)) {
        updateTabCount('active', activePromos.length);
      }
    } catch (err) {
      console.warn('[AREX] Failed to pre-fetch active promotions count', err);
    }

    // Fetch user's promotions count
    try {
      const addr = await ensureWalletAddress();
      if (addr) {
        const myPromos = await fetchMyPromotions(addr, { offset: 0, limit: 100, newestFirst: true, filter: 'all' });
        if (Array.isArray(myPromos)) {
          updateTabCount('mine', myPromos.length);
        }
      }
    } catch (err) {
      console.warn('[AREX] Failed to pre-fetch user promotions count', err);
    }
  };

  const syncHeaderControls = () => {
    // Filter menu (Mine tab only)
    myFilterWrap.style.display = currentTab === "mine" ? "block" : "none";
    if (currentTab !== "mine") {
      closeMyFilterMenu({ force: true });
    }
    // Sort menu (Active tab only)
    sortWrap.style.display = currentTab === "mine" ? "none" : "block";
    if (currentTab === "mine") {
      closeSortMenu({ force: true });
    }
  };

  myFilterButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (myFilterMenuOpen) {
      closeMyFilterMenu();
    } else {
      openMyFilterMenu();
    }
  });
  myFilterButton.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " " || ev.key === "ArrowDown") {
      ev.preventDefault();
      if (!myFilterMenuOpen) {
        openMyFilterMenu();
      }
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      closeMyFilterMenu({ restoreFocus: false });
    }
  });

  const headerRight = document.createElement("div");
  headerRight.className = "arex-header-right";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:transparent;border:1px solid rgba(148,163,184,.32);color:#94a3b8;font-size:16px;cursor:pointer;border-radius:999px;transition:all .2s ease;";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "rgba(255,255,255,.06)";
    closeBtn.style.color = "#e2e8f0";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#94a3b8";
  });
  closeBtn.addEventListener("click", closePromotionsListModal);

  headerRight.appendChild(myFilterWrap);
  headerRight.appendChild(sortWrap);
  headerRight.appendChild(closeBtn);

  const headerLeft = document.createElement("div");
  headerLeft.className = "arex-header-left";
  headerLeft.appendChild(refreshBtn);

  const tabsWrap = document.createElement("div");
  tabsWrap.className = "arex-header-center";
  const tabBar = document.createElement("div");
  tabBar.style.cssText =
    "display:flex;gap:4px;padding:4px;background:rgba(11,13,18,.72);border:1px solid rgba(148,163,184,.3);border-radius:999px;box-shadow:0 10px 26px rgba(0,0,0,.45);";
  const makeTabButton = (label: string, key: PromotionsTab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.tabKey = key;
    btn.setAttribute("aria-pressed", key === currentTab ? "true" : "false");
    btn.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:6px",
      "padding:6px 14px",
      "border-radius:999px",
      "border:1px solid transparent",
      "background:transparent",
      "color:#cbd5f5",
      "font-size:12px",
      "font-weight:600",
      "cursor:pointer",
      "transition:all .2s ease",
    ].join(";");
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    const countSpan = document.createElement("span");
    countSpan.textContent = "(0)";
    countSpan.style.cssText = "font-size:11px;opacity:.85;";
    tabCountLabels[key] = countSpan;
    btn.appendChild(labelSpan);
    btn.appendChild(countSpan);
    btn.addEventListener("click", () => {
      if (currentTab === key) return;
      currentTab = key;
      ignoreFollowerFilter = false;
      updateTabVisualState();
      syncHeaderControls();
      loadAndRender(true);
    });
    tabButtons[key] = btn;
    return btn;
  };
  tabBar.appendChild(makeTabButton("Active", "active"));
  tabBar.appendChild(makeTabButton("Mine", "mine"));
  tabsWrap.appendChild(tabBar);
  header.appendChild(headerLeft);
  header.appendChild(tabsWrap);
  header.appendChild(headerRight);

  // Controls bar removed, items moved to headerRight

  updateTabVisualState();
  syncHeaderControls();

  // Content
  const content = document.createElement("div");
  content.style.cssText =
    "flex:1;display:flex;flex-direction:column;gap:10px;overflow:auto;padding-right:4px;";
  const loadingWrap = document.createElement("div");
  loadingWrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 0;";
  const spinner = createSpinner(44);
  spinner.style.border = "4px solid rgba(249,115,22,.12)";
  spinner.style.borderTopColor = "#f97316";
  const loadingLabel = document.createElement("div");
  loadingLabel.textContent = "Loading promotions...";
  loadingLabel.style.cssText = "font-size:13px;color:#cbd5e1;";
  loadingWrap.appendChild(spinner);
  loadingWrap.appendChild(loadingLabel);
  loadingWrap.style.display = "none";
  // Controls: sort dropdown + loader
  content.appendChild(loadingWrap);

  // Container for the promotion cards
  const listWrap = document.createElement("div");
  listWrap.style.cssText = "display:flex;flex-direction:column;gap:10px;";
  content.appendChild(listWrap);

  // Load more button (below the cards)
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.textContent = "Load more";
  loadMoreBtn.style.cssText = "background:#0b0d12;border:1px solid rgba(148,163,184,.35);color:#e5e7eb;padding:8px 12px;border-radius:8px;font-size:13px;cursor:pointer;align-self:center;display:none;";
  content.appendChild(loadMoreBtn);

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Wire up refresh button
  refreshBtn.addEventListener("click", () => {
    loadAndRender(true);
  });

  const countdownTimers: number[] = [];
  (overlay as any)._arexCountdowns = countdownTimers;

  const ensureEmptyState = () => {
    if (content.querySelector("[data-arex-card]")) return;
    if (content.querySelector("[data-empty-state]")) return;
    const empty = document.createElement("div");
    empty.dataset.emptyState = "true";
    empty.textContent = "No promotions available right now. Check back soon!";
    empty.style.cssText =
      "font-size:13px;color:#cbd5e1;text-align:center;padding:24px 0;";
    content.appendChild(empty);
  };

  const removeEmptyState = () => {
    const empty = content.querySelector("[data-empty-state]");
    if (empty) empty.remove();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      if (sortMenuOpen) {
        ev.preventDefault();
        closeSortMenu({ restoreFocus: true });
        return;
      }
      closePromotionsListModal();
    }
  };
  (overlay as any)._arexOnKey = onKey;
  document.addEventListener("keydown", onKey);

  // Pre-fetch tab counts for a better UX
  fetchAllTabCounts();

  // Fetch and render using filtered, paginated API + load more flow
  let page = 0;
  const limit = 10;
  let allPromos: any[] = [];
  let canLoadMore = false;
  let loadRequestId = 0;

  // Token metadata cache
  const tokenMetadataCache = new Map<string, any>();

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const getTokenMetadata = async (tokenAddress: string | undefined) => {
    const addr = (tokenAddress || ARENA_TOKEN_ADDRESS).toLowerCase();

    // Check cache
    if (tokenMetadataCache.has(addr)) {
      return tokenMetadataCache.get(addr);
    }

    // Default ARENA metadata
    if (addr === ARENA_TOKEN_ADDRESS.toLowerCase()) {
      const metadata = {
        symbol: "ARENA",
        name: "Arena Token",
        decimals: ARENA_TOKEN_DECIMALS,
      };
      tokenMetadataCache.set(addr, metadata);
      return metadata;
    }

    // Fetch from contract
    try {
      const data = await getRewardTokenMetadata(tokenAddress!);
      const metadata = data || {
        symbol: shortenAddress(tokenAddress!),
        decimals: ARENA_TOKEN_DECIMALS,
      };
      tokenMetadataCache.set(addr, metadata);
      return metadata;
    } catch (error) {
      console.warn("[AREX] Failed to fetch token metadata for", tokenAddress, error);
      const fallback = {
        symbol: shortenAddress(tokenAddress!),
        decimals: ARENA_TOKEN_DECIMALS,
      };
      tokenMetadataCache.set(addr, fallback);
      return fallback;
    }
  };

  const computeSortKey = (): SortOptionKey => currentSortKey;

  const clearList = () => {
    listWrap.innerHTML = "";
  };

  const showShimmerPlaceholders = () => {
    clearList();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 2; i += 1) {
      frag.appendChild(createShimmerCard());
    }
    listWrap.appendChild(frag);
  };

  const removeShimmerPlaceholders = () => {
    Array.from(listWrap.querySelectorAll("[data-arex-shimmer]")).forEach((el) =>
      el.remove()
    );
  };

  async function loadAndRender(reset = false) {
    const requestId = ++loadRequestId;
    const isStaleRequest = () => requestId !== loadRequestId;
    const isMineTab = currentTab === "mine";
    loadingLabel.textContent = isMineTab
      ? "Loading your promotions..."
      : "Loading promotions...";
    try {
      if (reset) {
        page = 0;
        allPromos = [];
      }
      const shouldShowPlaceholders = reset || allPromos.length === 0;
      if (shouldShowPlaceholders) {
        showShimmerPlaceholders();
      }
      loadingWrap.style.display = "none";
      removeEmptyState();
      const sortKey = computeSortKey();
      let fetched: any[] = [];
      if (isMineTab) {
        const addr = await ensureWalletAddress();
        if (isStaleRequest()) return;
        if (!addr) {
          removeShimmerPlaceholders();
          clearList();
          const message = document.createElement("div");
          message.textContent =
            "Connect your Arena wallet to view promotions you've created.";
          message.style.cssText =
            "font-size:13px;color:#cbd5e1;text-align:center;padding:24px 0;";
          listWrap.appendChild(message);
          canLoadMore = false;
          loadMoreBtn.style.display = "none";
          updateTabCount("mine", 0);
          return;
        }
        const newestFirst = currentSortKey !== "oldest";
        const offset = page * limit;
        fetched = await fetchMyPromotions(addr, {
          offset,
          limit,
          newestFirst,
          filter: currentMyFilter,
        });
        if (isStaleRequest()) return;
        fetched = Array.isArray(fetched) ? fetched : [];
        if (reset) {
          allPromos = fetched;
        } else {
          allPromos = allPromos.concat(fetched);
        }
        canLoadMore = fetched.length === limit;
        updateTabCount("mine", allPromos.length);
      } else {
        // Active tab logic

        // 1. Check login status
        let twitterUser: any = null;
        try {
          const appState = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage({ type: "GET_APP_STATE" }, resolve);
          });
          twitterUser = appState?.twitterUser;
        } catch (e) {
          console.warn("[AREX] Failed to check login status", e);
        }

        if (!twitterUser) {
          removeShimmerPlaceholders();
          clearList();
          const message = document.createElement("div");
          message.textContent = "Please link X profile in extension to view active promotions.";
          message.style.cssText =
            "font-size:13px;color:#cbd5e1;text-align:center;padding:24px 0;";

          const loginLink = document.createElement("a");
          loginLink.textContent = "Link profile";
          loginLink.href = chrome.runtime.getURL("index.html?tab=profile");
          loginLink.target = "_blank";
          loginLink.style.cssText = "color:#f97316;text-decoration:none;margin-left:6px;";
          // message.appendChild(loginLink);

          listWrap.appendChild(message);
          canLoadMore = false;
          loadMoreBtn.style.display = "none";
          updateTabCount("active", 0);
          return;
        }

        // 2. Fetch follower count
        let userFollowerCount = 0;
        try {
          const authToken = await getBearerToken();
          if (authToken) {
            const username = twitterUser.user_metadata?.user_name;
            if (username) {
              const res = await fetch(
                `https://api.starsarena.com/user/handle?handle=${encodeURIComponent(username)}`,
                { headers: { Authorization: authToken } }
              );
              if (res.ok) {
                const data = await res.json();
                userFollowerCount = Number(data?.user?.followerCount || 0);
              }
            }
          }
        } catch (e) {
          console.warn("[AREX] Failed to fetch follower count", e);
        }

        // 3. Fetch and filter promotions
        let promos: any[] = [];
        if (sortKey === "reward") {
          const totalTake = (page + 1) * limit;
          promos = await fetchPromotionsFiltered({
            sortKey: "latest",
            offset: 0,
            limit: totalTake,
          });
          if (isStaleRequest()) return;
          promos = Array.isArray(promos) ? promos : [];
          promos.sort((a, b) => {
            try {
              const aa = BigInt(String(a.rewardPerSlot || "0"));
              const bb = BigInt(String(b.rewardPerSlot || "0"));
              return bb === aa ? 0 : bb > aa ? 1 : -1;
            } catch {
              return 0;
            }
          });
        } else {
          const newestFirst = sortKey !== "oldest";
          const offset = page * limit;
          promos = await fetchPromotionsFiltered({
            sortKey,
            offset,
            limit,
            newestFirst,
          });
        }

        if (isStaleRequest()) return;
        fetched = Array.isArray(promos) ? promos : [];

        // Update the tab count with the total number of fetched promotions before filtering
        if (reset) {
          updateTabCount("active", fetched.length);
        } else {
          // When loading more, the count is additive, but since we are filtering client-side,
          // the total count from the pre-fetch is more reliable.
          // We can simply avoid updating the count here on subsequent loads.
        }

        // Filter by follower count if not ignored
        let filtered = fetched;
        if (!ignoreFollowerFilter) {
          filtered = fetched.filter(p => {
            const minFollowers = Number(p.minFollowers || 0);
            return userFollowerCount >= minFollowers;
          });

          // Show empty state if filtering removed all items
          if (filtered.length === 0 && fetched.length > 0) {
            removeShimmerPlaceholders();
            clearList();

            const container = document.createElement("div");
            container.style.cssText = "border:1px dashed rgba(59,130,246,0.3);background:rgba(59,130,246,0.05);border-radius:12px;padding:24px;text-align:center;margin:12px 0;";

            const title = document.createElement("h3");
            title.textContent = "No promotions match your follower count yet";
            title.style.cssText = "font-size:15px;font-weight:600;color:#e2e8f0;margin-bottom:8px;";

            const desc = document.createElement("p");
            desc.textContent = `Your profile currently has ${userFollowerCount} followers, which doesn't meet the minimum for the available promotions.`;
            desc.style.cssText = "font-size:13px;color:#94a3b8;margin-bottom:16px;line-height:1.5;";

            const showAllBtn = document.createElement("button");
            showAllBtn.textContent = "Show all promotions";
            showAllBtn.style.cssText = "background:linear-gradient(120deg, #4f46e5, #3b82f6);color:white;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:opacity 0.2s;";
            showAllBtn.addEventListener("mouseenter", () => showAllBtn.style.opacity = "0.9");
            showAllBtn.addEventListener("mouseleave", () => showAllBtn.style.opacity = "1");
            showAllBtn.addEventListener("click", () => {
              ignoreFollowerFilter = true;
              loadAndRender(true);
            });

            container.appendChild(title);
            container.appendChild(desc);
            container.appendChild(showAllBtn);
            listWrap.appendChild(container);

            canLoadMore = false;
            loadMoreBtn.style.display = "none";
            return;
          }
        }

        // Use filtered list
        fetched = filtered;

        if (reset) {
          allPromos = fetched;
        } else {
          allPromos = allPromos.concat(fetched);
        }

        // Note: Pagination logic is slightly broken by client-side filtering
        // because we might fetch 'limit' items but filter them all out.
        // For now, this is the requested behavior.
        canLoadMore = fetched.length > 0; // Simplified check
        updateTabCount("active", allPromos.length);
      }

      if (isStaleRequest()) return;
      removeShimmerPlaceholders();
      loadingWrap.style.display = "none";

      if (allPromos.length === 0) {
        clearList();
        const empty = document.createElement("div");
        empty.textContent = isMineTab
          ? "You haven't created any promotions yet."
          : "No promotions found for the selected filters.";
        empty.style.cssText =
          "font-size:13px;color:#cbd5e1;text-align:center;padding:24px 0;";
        listWrap.appendChild(empty);
        loadMoreBtn.style.display = "none";
        return;
      }

      // Augment promotions with contentURI data if needed
      const augmentationPromises = allPromos.map(async (p) => {
        if (p.contentURI) {
          try {
            const remote = await fetchTextViaBackground(p.contentURI as string);
            const parsedRemote = JSON.parse(remote); // Assuming it's JSON
            if (parsedRemote && (parsedRemote.likesMandatory || parsedRemote.require_like)) {
              p.require_like = true; // Augment the promotion object
            }
          } catch (err) {
            console.warn(`[AREX] Failed to resolve contentURI for promotion ${p.id}`, err);
          }
        }
      });

      await Promise.all(augmentationPromises);

      // Re-render all
      clearList();
      for (const p of allPromos) {
        const card = document.createElement("div");
        card.setAttribute("data-arex-card", "");
        card.style.cssText = [
          "border:1px solid rgba(148,163,184,.18)",
          "border-radius:14px",
          "padding:14px",
          "background:linear-gradient(180deg, rgba(17,17,20,.72), rgba(12,12,15,.66))",
          "box-shadow:0 12px 28px rgba(0,0,0,.45)",
          "display:flex",
          "flex-direction:column",
          "gap:12px",
        ].join(";");

        removeEmptyState();

        const slotsAvailable = Number(p.slotsAvailable ?? 0);
        const slotsTaken = Number(p.slotsTaken ?? 0);
        const slotsLeft = Math.max(slotsAvailable - slotsTaken, 0);
        const slotsPercent =
          slotsAvailable > 0 ? Math.min(slotsTaken / slotsAvailable, 1) : 0;
        const expiresOn = Number(p.expiresOn || 0);
        const isMineView = isMineTab;
        const isExpired =
          expiresOn > 0 ? expiresOn * 1000 <= Date.now() : false;
        let hasUnusedVault = false;
        try {
          const vaultAmountBig = BigInt(String(p.vaultAmount || "0"));
          const rewardPerSlotBig = BigInt(String(p.rewardPerSlot || "0"));
          const slotsTakenBig = BigInt(Math.max(slotsTaken, 0));
          hasUnusedVault = vaultAmountBig > rewardPerSlotBig * slotsTakenBig;
        } catch {
          hasUnusedVault = slotsAvailable > 0 ? slotsLeft > 0 : false;
        }

        // Get promotion type styles
        const promType = Number(p.promotionType);
        const typeStyle = PROMOTION_TYPE_STYLES[promType] || DEFAULT_PROMOTION_STYLE;

        // Initial values - will be updated async
        let tokenSymbol = "ARENA";
        const rewardDisplay = formatUnitsStr(String(p.rewardPerSlot || "0"));

        let countdownTimer: number | null = null;
        let cardAborted = false;
        const cleanUpAndRemove = () => {
          cardAborted = true;
          if (countdownTimer !== null) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          if (card.isConnected) {
            card.remove();
            ensureEmptyState();
          }
        };

        const headerRow = document.createElement("div");
        headerRow.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;flex-wrap:wrap;";
        const hLeft = document.createElement("div");
        hLeft.style.cssText =
          "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";

        // Type badge with custom colors
        const typeBadge = document.createElement("span");
        typeBadge.textContent = promotionTypeLabel(promType);
        typeBadge.style.cssText =
          `font-size:12px;background:${typeStyle.badgeGradient};color:white;padding:4px 8px;border-radius:999px;border:1px solid ${typeStyle.badgeBorder}`;
        hLeft.appendChild(typeBadge);

        const makeChip = (label: string, value: string) => {
          const chip = document.createElement("div");
          chip.style.cssText =
            "display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(234,88,12,.12);border:1px solid rgba(234,88,12,.25);";
          const labelSpan = document.createElement("span");
          labelSpan.textContent = label;
          labelSpan.style.cssText =
            "font-size: 11px;color:#f1f5f9be;text-transform:uppercase;letter-spacing:.4px;";
          const valueSpan = document.createElement("span");
          valueSpan.textContent = value;
          valueSpan.style.cssText =
            "font-size:13px;font-weight:600;color:#fb923c;";
          chip.appendChild(labelSpan);
          chip.appendChild(valueSpan);
          return chip;
        };

        hLeft.appendChild(
          makeChip(
            "Slots left",
            slotsAvailable > 0 ? `${slotsLeft} open` : "Open-ended"
          )
        );

        const rewardChip = makeChip("Reward", `${rewardDisplay} ${tokenSymbol}`);
        hLeft.appendChild(rewardChip);
        hLeft.appendChild(
          makeChip("Min followers", `${p.minFollowers || 0}+`)
        );

        // Add likes mandatory badge if required
        if (p.require_like) {
          const likesBadge = document.createElement("span");
          likesBadge.style.cssText =
            "display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.25);font-size:11px;color:#fda4af;font-weight:600;letter-spacing:.4px;";
          likesBadge.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
          LIKE REQUIRED
        `;
          hLeft.appendChild(likesBadge);
        }

        headerRow.appendChild(hLeft);

        const hRight = document.createElement("div");
        hRight.style.cssText = "font-size:12px;color:#94a3b8";
        hRight.textContent = `ID ${p.id}`;
        headerRow.appendChild(hRight);

        // Two-column body (post preview + summary)
        const cardBody = document.createElement("div");
        cardBody.style.cssText =
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;align-items:start;";

        // Post content section
        const postSection = document.createElement("div");
        postSection.style.cssText =
          "padding:12px;background:rgba(0,0,0,.25);border-radius:10px;border:1px solid rgba(148,163,184,.2);";
        const postHeading = document.createElement("div");
        postHeading.textContent = "Post preview";
        postHeading.style.cssText =
          "font-size:11px;color:#94a3b8;margin-bottom:6px;letter-spacing:.4px;text-transform:uppercase;";
        postSection.appendChild(postHeading);

        // Show promoter-provided custom message (only for Comment and Quote)
        if ((Number(p.promotionType) === 0 || Number(p.promotionType) === 2) && p.contentURI) {
          const customHeading = document.createElement("div");
          customHeading.textContent = Number(p.promotionType) === 0 ? "Your comment" : "Your quote";
          customHeading.style.cssText =
            "font-size:11px;color:#fb923c;margin:8px 0 4px;letter-spacing:.4px;text-transform:uppercase;";
          postSection.appendChild(customHeading);

          const customMsg = document.createElement("div");
          customMsg.style.cssText =
            "font-size:13px;color:#e5e7eb;line-height:1.45;border:1px solid rgba(234,88,12,.25);background:rgba(2,6,23,.35);padding:10px;border-radius:8px;margin-bottom:10px;white-space:pre-wrap;word-break:break-word;";
          customMsg.textContent = "Loading promotion content...";
          postSection.appendChild(customMsg);

          (async () => {
            try {
              const resolved = await resolvePromotionContent(p);
              if (!resolved) {
                customMsg.textContent = "(no message provided)";
                return;
              }
              const preview =
                resolved.length > 260 ? `${resolved.slice(0, 260)}...` : resolved;
              customMsg.textContent = preview || "(no message provided)";
            } catch (e) {
              console.warn(
                "[AREX] Failed to resolve promotion content for preview",
                e
              );
              customMsg.textContent = "(no message provided)";
            }
          })();
        }

        const postLoading = document.createElement("div");
        const applyPostShimmer = () => {
          postLoading.innerHTML = "";
          postLoading.style.cssText =
            "display:flex;flex-direction:column;gap:10px;padding:6px 0;";
          const shimmerHeader = document.createElement("div");
          shimmerHeader.style.cssText =
            "display:flex;align-items:center;gap:10px;";
          shimmerHeader.appendChild(createShimmerBlock("40px", "40px", 20));
          const shimmerHeaderText = document.createElement("div");
          shimmerHeaderText.style.cssText =
            "flex:1;display:flex;flex-direction:column;gap:6px;";
          shimmerHeaderText.appendChild(
            createShimmerBlock("70%", "10px", 6)
          );
          shimmerHeaderText.appendChild(
            createShimmerBlock("45%", "8px", 6)
          );
          shimmerHeader.appendChild(shimmerHeaderText);
          postLoading.appendChild(shimmerHeader);
          postLoading.appendChild(createShimmerBlock("100%", "10px", 6));
          postLoading.appendChild(createShimmerBlock("95%", "10px", 6));
          postLoading.appendChild(createShimmerBlock("85%", "10px", 6));
        };
        const setPostLoadingMessage = (
          text: string,
          color = "#94a3b8",
          italic = true
        ) => {
          postLoading.innerHTML = "";
          postLoading.style.cssText = [
            "font-size:12px",
            `color:${color}`,
            `font-style:${italic ? "italic" : "normal"}`,
          ].join(";");
          postLoading.textContent = text;
        };
        applyPostShimmer();
        postSection.appendChild(postLoading);

        if (p.postId) {
          const renderPostPreview = (postData: any) => {
            if (cardAborted) return;

            if (!postData) {
              console.warn("[AREX] Missing post data for promotion", p.id);
              setPostLoadingMessage("Post preview unavailable.", "#ef4444", false);
              return;
            }

            const resolved = postData?.thread ?? postData;

            if (!resolved) {
              setPostLoadingMessage("Post preview unavailable.", "#ef4444", false);
              return;
            }

            if (postLoading.isConnected) {
              postLoading.remove();
            }

            const authorInfo = document.createElement("div");
            authorInfo.style.cssText =
              "display:flex;align-items:center;gap:8px;margin-bottom:8px;";

            const possibleAvatar =
              resolved.userPicture ||
              resolved.userImageUrl ||
              resolved.profileImageUrl ||
              resolved.previewImageUrl ||
              resolved.user?.profileImageUrl ||
              resolved.user?.pictureUrl ||
              resolved.author?.profileImageUrl;
            if (possibleAvatar) {
              const avatar = document.createElement("img");
              avatar.src = possibleAvatar;
              avatar.style.cssText =
                "width:24px;height:24px;border-radius:50%;";
              avatar.alt = "Post author";
              avatar.addEventListener("error", () => {
                avatar.remove();
              });
              authorInfo.appendChild(avatar);
            }

            const authorName = document.createElement("div");
            authorName.style.cssText =
              "font-size:13px;font-weight:600;color:#e5e7eb;";
            authorName.textContent =
              resolved.userName ||
              resolved.user?.userName ||
              resolved.author?.userName ||
              resolved.userHandle ||
              "Unknown";
            authorInfo.appendChild(authorName);

            const authorHandle = document.createElement("div");
            authorHandle.style.cssText = "font-size:12px;color:#94a3b8;";
            const handleValue =
              resolved.userHandle ||
              resolved.user?.handle ||
              resolved.author?.handle ||
              resolved.user?.userName ||
              "unknown";
            authorHandle.textContent = `@${handleValue}`;
            authorInfo.appendChild(authorHandle);

            postSection.appendChild(authorInfo);

            const rawContent =
              resolved.content ||
              resolved.rawContent ||
              resolved.text ||
              "";

            if (rawContent) {
              const contentDiv = document.createElement("div");
              contentDiv.style.cssText =
                "font-size:13px;color:#cbd5e1;line-height:1.4;margin-bottom:8px;";
              const textContent = rawContent.replace(/<[^>]*>/g, "").trim();
              contentDiv.textContent =
                textContent.length > 200
                  ? textContent.substring(0, 200) + "..."
                  : textContent;
              postSection.appendChild(contentDiv);
            }

            const images =
              resolved.images ||
              resolved.media ||
              resolved.attachments ||
              [];

            if (Array.isArray(images) && images.length > 0) {
              const imagesContainer = document.createElement("div");
              imagesContainer.style.cssText =
                "display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;";

              for (let i = 0; i < images.length && i < 3; i++) {
                const img = images[i];
                const url = img?.url || img?.imageUrl || img?.src;
                if (!url) continue;
                const imgElement = document.createElement("img");
                imgElement.src = url;
                imgElement.style.cssText =
                  "width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid rgba(148,163,184,.2);";
                imgElement.alt = `Image ${i + 1}`;
                imagesContainer.appendChild(imgElement);
              }

              if (imagesContainer.childElementCount > 0) {
                postSection.appendChild(imagesContainer);
              }
            }
          };

          if (p.postData) {
            renderPostPreview(p.postData);
          } else {
            fetchPostContent(p.postId)
              .then((postData) => {
                renderPostPreview(postData);
              })
              .catch((err) => {
                console.error("[AREX] Error loading post content:", err);
                if (cardAborted) return;
                setPostLoadingMessage("Post preview unavailable.", "#ef4444", false);
              });
          }
        } else {
          console.warn("[AREX] Promotion missing postId", p.id);
          setPostLoadingMessage("Post reference unavailable.", "#f87171", false);
        }

        const infoGrid = document.createElement("div");
        infoGrid.style.cssText =
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;";

        const addField = (label: string, value: string | HTMLElement) => {
          const wrap = document.createElement("div");
          const l = document.createElement("div");
          l.textContent = label;
          l.style.cssText = "font-size:11px;color:#94a3b8;margin-bottom:2px;";
          const v = document.createElement("div");
          v.style.cssText =
            "font-size:13px;color:#e5e7eb;display:flex;align-items:center;gap:6px;";
          if (typeof value === "string") {
            v.textContent = value;
          } else {
            v.appendChild(value);
          }
          wrap.appendChild(l);
          wrap.appendChild(v);
          infoGrid.appendChild(wrap);
        };

        addField("Slots", `${p.slotsTaken}/${p.slotsAvailable}`);
        const rewardField = document.createElement("div");
        rewardField.setAttribute("data-field", "reward");
        rewardField.textContent = `${rewardDisplay} ${tokenSymbol}`;
        addField("Reward/Slot", rewardField);
        const vaultField = document.createElement("div");
        vaultField.setAttribute("data-field", "vault");
        vaultField.textContent = `${formatUnitsStr(String(p.vaultAmount || "0"))} ${tokenSymbol}`;
        addField("Vault", vaultField);
        addField("Min Followers", String(p.minFollowers || 0));
        addField("Engagements", String(p.engagementsCount || 0));
        const expiresValue = document.createElement("span");
        expiresValue.style.cssText =
          "padding:4px 8px;border-radius:999px;background:rgba(234,88,12,.15);color:#fb923c;font-weight:600;font-size:12px;";

        const hideExpiredCard = currentTab === "active";
        const updateExpiryText = () => {
          if (cardAborted) return;
          if (!expiresOn) {
            expiresValue.textContent = "No expiry";
            return;
          }

          const diffMs = expiresOn * 1000 - Date.now();
          if (diffMs <= 0) {
            expiresValue.textContent = "Expired";
            if (hideExpiredCard) {
              cleanUpAndRemove();
            } else if (countdownTimer !== null) {
              clearInterval(countdownTimer);
              countdownTimer = null;
            }
            return;
          }

          expiresValue.textContent = formatTimeRemaining(diffMs);
        };

        updateExpiryText();
        if (expiresOn > 0 && !cardAborted) {
          countdownTimer = window.setInterval(updateExpiryText, 1000);
          countdownTimers.push(countdownTimer);
        }

        addField("Expires", expiresValue);

        if (p.require_like) {
          const likeValue = document.createElement("span");
          likeValue.style.cssText = "display:flex;align-items:center;gap:4px;color:#fda4af;font-weight:600;";
          likeValue.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            Like
          `;
          addField("Mandatory", likeValue);
        }

        // Summary panel
        const summaryWrap = document.createElement("div");
        summaryWrap.style.cssText =
          "padding:12px;border-radius:10px;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.22);";
        const summaryTitle = document.createElement("div");
        summaryTitle.textContent = "Summary";
        summaryTitle.style.cssText =
          "font-size:12px;color:#fb923c;margin-bottom:6px;font-weight:600;letter-spacing:.2px;";
        summaryWrap.appendChild(summaryTitle);
        summaryWrap.appendChild(infoGrid);

        if (slotsAvailable > 0) {
          const progressWrap = document.createElement("div");
          progressWrap.style.cssText = "margin-top:10px;";
          const progressLabel = document.createElement("div");
          progressLabel.textContent = `${slotsTaken}/${slotsAvailable} slots filled`;
          progressLabel.style.cssText =
            "font-size:11px;color:#cbd5e1;margin-bottom:4px;";
          const progressBar = document.createElement("div");
          progressBar.style.cssText =
            "height:6px;border-radius:999px;background:rgba(148,163,184,.22);overflow:hidden;";
          const progressFill = document.createElement("div");
          const percent = Math.round(slotsPercent * 100);
          progressFill.style.cssText = `height:100%;width:${percent}%;background:linear-gradient(90deg,#f97316,#ea580c);transition:width .3s ease;`;
          progressBar.appendChild(progressFill);
          progressWrap.appendChild(progressLabel);
          progressWrap.appendChild(progressBar);
          summaryWrap.appendChild(progressWrap);
        }

        // Compose card body
        cardBody.appendChild(postSection);
        cardBody.appendChild(summaryWrap);

        card.appendChild(headerRow);
        card.appendChild(cardBody);

        // Action button with spinner feedback
        const actionBtn = document.createElement("button");
        actionBtn.style.cssText =
          `background:${typeStyle.buttonGradient};border:1px solid ${typeStyle.badgeBorder};color:white;padding:12px 14px;border-radius:10px;margin-top:12px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s ease,filter .15s ease;width:100%;min-height:48px;`;
        const baseActionText = `${promotionTypeLabel(
          Number(p.promotionType)
        )} for ${rewardDisplay} ${tokenSymbol}`;
        const actionLabel = document.createElement("span");
        const actionSpinner = createSpinner(18);
        actionSpinner.style.display = "none";
        actionSpinner.style.border = "3px solid rgba(255,255,255,.25)";
        actionSpinner.style.borderTopColor = "#fff";
        actionSpinner.style.width = "18px";
        actionSpinner.style.height = "18px";
        actionSpinner.style.marginLeft = "6px";
        actionBtn.appendChild(actionLabel);
        actionBtn.appendChild(actionSpinner);

        type ActionMode = "engage" | "cancel" | "claim" | "none";
        let actionMode: ActionMode = "engage";
        if (isMineView) {
          if (!hasUnusedVault) {
            actionMode = "none";
          } else if (p.active && isExpired) {
            actionMode = "claim";
          } else if (p.active) {
            actionMode = "cancel";
          } else {
            actionMode = "none";
          }
        }
        const defaultActionText =
          actionMode === "engage"
            ? baseActionText
            : actionMode === "cancel"
              ? "Cancel promotion"
              : actionMode === "claim"
                ? "Get unused vault"
                : "Vault already claimed";
        actionLabel.textContent = defaultActionText;

        const applyDisabledState = (disabled: boolean) => {
          actionBtn.disabled = disabled;
          actionBtn.style.opacity = disabled ? "0.5" : "1";
          actionBtn.style.cursor = disabled ? "not-allowed" : "pointer";
        };
        const baseDisabled =
          actionMode === "engage" ? !p.active : actionMode === "none";
        const setActionLoading = (loading: boolean, loadingText?: string) => {
          if (loading) {
            actionBtn.dataset.loading = "1";
            actionSpinner.style.display = "inline-flex";
            actionLabel.textContent = loadingText || "Processing...";
            actionBtn.style.opacity = "0.85";
            actionBtn.disabled = true;
            actionBtn.style.cursor = "wait";
          } else {
            actionBtn.dataset.loading = "0";
            actionSpinner.style.display = "none";
            actionLabel.textContent = defaultActionText;
            applyDisabledState(baseDisabled);
          }
        };
        setActionLoading(false);

        actionBtn.addEventListener("mouseenter", () => {
          if (actionBtn.disabled || actionBtn.dataset.loading === "1") return;
          actionBtn.style.filter = "brightness(1.05)";
          actionBtn.style.transform = "translateY(-1px)";
        });
        actionBtn.addEventListener("mouseleave", () => {
          actionBtn.style.filter = "none";
          actionBtn.style.transform = "none";
        });

        const handleCancelOrClaim = async () => {
          const loadingText =
            actionMode === "claim" ? "Claiming vault..." : "Cancelling...";
          setActionLoading(true, loadingText);
          try {
            await cancelPromotionTx(Number(p.id));
            showToast(
              actionMode === "claim"
                ? "Unused vault claimed successfully."
                : "Promotion cancelled successfully."
            );
            await loadAndRender(true);
          } catch (err) {
            console.error("[AREX] Cancel vault action failed:", err);
            const message =
              err instanceof Error ? err.message : "Failed to update promotion.";
            showToast(message);
            setActionLoading(false);
          }
        };

        actionBtn.addEventListener("click", async () => {
          if (actionBtn.dataset.loading === "1" || baseDisabled) {
            return;
          }

          if (actionMode === "cancel" || actionMode === "claim") {
            void handleCancelOrClaim();
            return;
          }

          setActionLoading(true, "Preparing...");

          try {
            const walletStatus = await getWalletStatus();
            if (!walletStatus) {
              showToast("Failed to check wallet status. Please try again.");
              setActionLoading(false);
              return;
            }
            if (!walletStatus.isUnlocked) {
              showToast("Wallet is locked. Please unlock your wallet first.");
              const unlocked = await promptAndWaitForWalletUnlock();
              if (!unlocked) {
                showToast("Wallet unlock was cancelled or timed out.");
                setActionLoading(false);
                return;
              }
            }
          } catch (err) {
            logError("Failed while verifying wallet status:", err);
            showToast("Failed to check wallet status. Please try again.");
            setActionLoading(false);
            return;
          }

          // Wallet is unlocked, now ensure user is logged in
          chrome.runtime.sendMessage(
            { type: "CHECK_LOGIN_STATUS" },
            (loginResponse) => {
              if (chrome.runtime.lastError) {
                const err = `Failed to check login status: ${chrome.runtime.lastError.message}`;
                logError(err);
                showToast(err);
                setActionLoading(false);
                return;
              }
              if (!loginResponse || !loginResponse.isLoggedIn) {
                showToast("Please log in first to engage in promotions.");
                setActionLoading(false);
                return;
              }

              // Wallet unlocked and user logged in, proceed
              proceedWithEngagement();
            }
          );

          function proceedWithEngagement() {
            chrome.runtime.sendMessage(
              { type: "GET_BEARER_TOKEN" },
              async (response) => {
                if (chrome.runtime.lastError) {
                  const err = `Failed to get token: ${chrome.runtime.lastError.message}`;
                  logError(err);
                  showToast(err);
                  setActionLoading(false);
                  return;
                }
                if (response.error) {
                  const err = `Failed to get token: ${response.error}`;
                  logError(err);
                  showToast(err);
                  setActionLoading(false);
                  return;
                }

                const authToken = normalizeAuthToken(response.token);
                if (!authToken) {
                  showToast("Invalid authentication token. Please log in again.");
                  setActionLoading(false);
                  return;
                }

                const threadId = p.postId;
                if (!threadId) {
                  showToast("No thread ID found for this promotion.");
                  setActionLoading(false);
                  return;
                }

                const promotionType = Number(p.promotionType);

                // Guard: fetch logged-in username and actual follower count in frontend
                let followerCountActual = 0;
                try {
                  const appState = await new Promise<any>((resolve) => {
                    chrome.runtime.sendMessage({ type: "GET_APP_STATE" }, resolve);
                  });
                  const twitterUsername = appState?.twitterUser?.user_metadata?.user_name || "";
                  if (!twitterUsername) {
                    showToast("Please log in to verify eligibility.");
                    setActionLoading(false);
                    return;
                  }
                  const authHeader = { Authorization: authToken };
                  const starsArenaBase = import.meta.env.VITE_STARS_ARENA_API_URL || 'https://api.starsarena.com';
                  const followerRes = await fetch(
                    `${starsArenaBase}/user/handle?handle=${encodeURIComponent(twitterUsername)}`,
                    { headers: authHeader }
                  );
                  if (followerRes.ok) {
                    const data = await followerRes.json();
                    followerCountActual = Number(data?.user?.followerCount || 0);
                  }
                } catch (e) {
                  console.warn("[AREX] Failed to fetch follower count on frontend", e);
                }

                // Pre-check 1: Like post if required
                if (p.require_like) {
                  try {
                    showToast("Liking post as required...");
                    const arenaSocialBase = import.meta.env.VITE_ARENA_SOCIAL_API_URL || 'https://api.arena.social';
                    const likeRes = await fetch(`${arenaSocialBase}/threads/like`, {
                      method: "POST",
                      headers: {
                        Authorization: authToken,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ threadId }),
                    });

                    if (!likeRes.ok) {
                      const errorText = await likeRes.text();
                      throw new Error(errorText || `Failed to like post: ${likeRes.status}`);
                    }
                    showToast("Post liked successfully!");
                  } catch (err: any) {
                    console.error("[AREX] Failed to like required post", err);
                    showToast(`Error: Could not like post. ${err.message}`);
                    setActionLoading(false);
                    return;
                  }
                }

                const requiredMinFollowers = Number(p.minFollowers || 0);
                if (requiredMinFollowers > 0 && followerCountActual < requiredMinFollowers) {
                  showToast(
                    `[ERROR] Insufficient followers. Required: ${requiredMinFollowers}, Actual: ${followerCountActual}`
                  );
                  setActionLoading(false);
                  return;
                }

                if (promotionType === 1) {
                  // Repost
                  showToast("Reposting thread...");
                  const starsArenaBase = import.meta.env.VITE_STARS_ARENA_API_URL || 'https://api.starsarena.com';
                  fetch(`${starsArenaBase}/threads/repost`, {
                    method: "POST",
                    headers: {
                      Authorization: authToken,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ threadId, content: "" }),
                  })
                    .then(async (res) => {
                      if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(errorText || `HTTP ${res.status}`);
                      }
                      return res.json();
                    })
                    .then(async (data) => {
                      console.log("[Nester] Repost success:", data);

                      // Call backend API to update onchain
                      try {
                        console.log("[DEBUG] Repost engagement data:", {
                          promotionId: p.id,
                          engagementPostId: data.thread?.id,
                          repostId: data.thread?.repostId,
                          promotionPostId: threadId,
                          fullThreadData: data.thread,
                          content: "",
                        });

                        await callEngageBackend({
                          promotionId: p.id,
                          engagementPostId: data.thread?.id, // Use id for repost, not repostId
                          engagementType: "repost",
                          threadData: data.thread,
                          promotionPostId: threadId,
                          content: "",
                          followerCount: followerCountActual,
                        });
                        showToast("Successfully reposted and recorded onchain!");
                      } catch (backendError) {
                        console.error("[Nester] Backend API error:", backendError);
                        showToast(
                          "Reposted successfully, but failed to record onchain"
                        );
                      }
                    })
                    .catch((err) => {
                      console.error("[Nester] Repost error:", err);
                      showToast(`Error reposting: ${err.message}`);
                    })
                    .finally(() => setActionLoading(false));
                } else if (promotionType === 0) {
                  const userId = getArenaUserId();
                  if (!userId) {
                    showToast("Could not find user ID to post comment.");
                    setActionLoading(false);
                    return;
                  }

                  showToast("Posting comment...");
                  let resolvedContent = "Claiming this promotion! 🚀";
                  try {
                    if (p.contentURI) {
                      const txt = await fetchTextViaBackground(p.contentURI);
                      if (txt) resolvedContent = txt;
                    }
                  } catch (e) {
                    console.warn(
                      "[AREX] Failed to resolve contentURI, using fallback",
                      e
                    );
                  }
                  let contentText = resolvedContent;
                  try {
                    const j = JSON.parse(resolvedContent);
                    if (j && typeof j === "object" && "content" in j) {
                      contentText = String((j as any).content ?? "");
                    }
                  } catch { }
                  const bodyContent = contentText.startsWith("<")
                    ? contentText
                    : `<p>${contentText}</p>`;
                  const payload = {
                    content: bodyContent,
                    files: [],
                    threadId: threadId,
                    userId: userId,
                  };

                  const arenaSocialBase = import.meta.env.VITE_ARENA_SOCIAL_API_URL || 'https://api.arena.social';
                  fetch(`${arenaSocialBase}/threads/answer`, {
                    method: "POST",
                    headers: {
                      Authorization: authToken,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                  })
                    .then(async (res) => {
                      if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(errorText || `HTTP ${res.status}`);
                      }
                      return res.json();
                    })
                    .then(async (data) => {
                      console.log("[Nester] Comment success:", data);

                      // Call backend API to update onchain
                      try {
                        await callEngageBackend({
                          promotionId: p.id,
                          engagementPostId: data.thread?.id,
                          engagementType: "comment",
                          threadData: data.thread,
                          promotionPostId: threadId,
                          content: contentText,
                          followerCount: followerCountActual,
                        });
                        showToast("Successfully commented and recorded onchain!");
                      } catch (backendError) {
                        console.error("[Nester] Backend API error:", backendError);
                        showToast(
                          "Commented successfully, but failed to record onchain"
                        );
                      }
                    })
                    .catch((err) => {
                      console.error("[Nester] Comment error:", err);
                      showToast(`Error commenting: ${err.message}`);
                    })
                    .finally(() => setActionLoading(false));
                } else if (promotionType === 2) {
                  // Quote
                  showToast("Quoting thread...");
                  let resolvedContent = "Just joined this promotion! 🚀";
                  try {
                    if (p.contentURI) {
                      const txt = await fetchTextViaBackground(p.contentURI);
                      if (txt) resolvedContent = txt;
                    }
                  } catch (e) {
                    console.warn(
                      "[AREX] Failed to resolve contentURI, using fallback",
                      e
                    );
                  }
                  let contentText = resolvedContent;
                  try {
                    const j = JSON.parse(resolvedContent);
                    if (j && typeof j === "object" && "content" in j) {
                      contentText = String((j as any).content ?? "");
                    }
                  } catch { }
                  const bodyContent = contentText.startsWith("<")
                    ? contentText
                    : `<p>${contentText}</p>`;
                  const payload = {
                    content: bodyContent,
                    files: [],
                    threadId: threadId,
                  };

                  const starsArenaBase = import.meta.env.VITE_STARS_ARENA_API_URL || 'https://api.starsarena.com';
                  fetch(`${starsArenaBase}/threads/quote`, {
                    method: "POST",
                    headers: {
                      Authorization: authToken,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                  })
                    .then(async (res) => {
                      if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(errorText || `HTTP ${res.status}`);
                      }
                      return res.json();
                    })
                    .then(async (data) => {
                      console.log("[Nester] Quote success:", data);

                      // Call backend API to update onchain
                      try {
                        await callEngageBackend({
                          promotionId: p.id,
                          engagementPostId: data.thread?.id,
                          engagementType: "quote",
                          threadData: data.thread,
                          promotionPostId: threadId,
                          content: contentText,
                          followerCount: followerCountActual,
                        });
                        showToast("Successfully quoted and recorded onchain!");
                      } catch (backendError) {
                        console.error("[Nester] Backend API error:", backendError);
                        showToast(
                          "Quoted successfully, but failed to record onchain"
                        );
                      }
                    })
                    .catch((err) => {
                      console.error("[Nester] Quote error:", err);
                      showToast(`Error quoting: ${err.message}`);
                    })
                    .finally(() => setActionLoading(false));
                } else {
                  showToast(
                    `Promotion type ${promotionTypeLabel(
                      promotionType
                    )} not handled yet.`
                  );
                  setActionLoading(false);
                }
              }
            );
          }
        });

        if (baseDisabled) {
          applyDisabledState(true);
          actionBtn.title =
            actionMode === "engage"
              ? "This promotion is not active"
              : "Vault already claimed";
        }

        card.appendChild(actionBtn);

        if (cardAborted) {
          cleanUpAndRemove();
          continue;
        }

        // Async: Fetch and update token metadata
        (async () => {
          try {
            // If rewardToken is missing or zero address, it's ARENA token
            const tokenAddr = p.rewardToken || ARENA_TOKEN_ADDRESS;
            console.log("[AREX] Fetching metadata for promotion", p.id, "token:", tokenAddr);
            const metadata = await getTokenMetadata(tokenAddr);
            console.log("[AREX] Got metadata:", metadata);
            const fetchedSymbol = metadata?.symbol || "ARENA";
            const tokenDecimals = metadata?.decimals ?? ARENA_TOKEN_DECIMALS;

            // Format amounts with correct decimals
            const formattedReward = formatUnitsStr(
              String(p.rewardPerSlot || "0"),
              tokenDecimals
            );
            const formattedVault = formatUnitsStr(
              String(p.vaultAmount || "0"),
              tokenDecimals
            );

            // Update reward chip
            const rewardValueSpan = rewardChip.querySelector("span:last-child") as HTMLSpanElement;
            if (rewardValueSpan) {
              rewardValueSpan.textContent = `${formattedReward} ${fetchedSymbol}`;
            }

            // Update reward field in summary
            if (rewardField) {
              rewardField.textContent = `${formattedReward} ${fetchedSymbol}`;
            }

            // Update vault field in summary
            if (vaultField) {
              vaultField.textContent = `${formattedVault} ${fetchedSymbol}`;
            }

            // Update action button text
            if (actionLabel && actionMode === "engage") {
              const actionTypeText = promotionTypeLabel(promType);
              actionLabel.textContent = `${actionTypeText} for ${formattedReward} ${fetchedSymbol}`;
            }
          } catch (err) {
            console.warn('[AREX] Failed to update token metadata for promotion', p.id, err);
          }
        })();

        listWrap.appendChild(card);
      }

      loadMoreBtn.style.display = canLoadMore ? "inline-flex" : "none";
      ensureEmptyState();
    } catch (err) {
      removeShimmerPlaceholders();
      loadingWrap.style.display = "none";
      console.error("[AREX] Failed to fetch promotions", err);
      clearList();
      const e = document.createElement("div");
      e.textContent =
        err instanceof Error ? err.message : "Failed to load promotions";
      e.style.cssText =
        "font-size:13px;color:#fca5a5;text-align:center;padding:24px 0;";
      listWrap.appendChild(e);
      loadMoreBtn.style.display = "none";
    }
  }

  // Hook up controls
  loadMoreBtn.addEventListener("click", () => {
    page += 1;
    void loadAndRender(false);
  });

  // Initial load
  try {
    await loadAndRender(true);
  } catch { }
}

function openPromotionModal(postId: string | null) {
  // Remove any existing modal
  const existing = document.getElementById("arex-promo-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "arex-promo-overlay";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "background:rgba(0,0,0,.65)",
    "backdrop-filter:blur(10px)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePromotionModal();
  });

  const modal = document.createElement("div");
  modal.id = "arex-promo-modal";
  modal.style.cssText = [
    "width:min(720px,96vw)",
    "max-height:88vh",
    "overflow:auto",
    "background:linear-gradient(180deg, rgba(17,17,20,.96), rgba(12,12,15,.98))",
    "backdrop-filter:blur(10px) saturate(120%)",
    "border:1px solid rgba(255,255,255,.06)",
    "color:#e5e7eb",
    "border-radius:16px",
    "box-shadow:0 24px 60px rgba(0,0,0,.7)",
    "padding:20px",
  ].join(";");

  // Header
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px";
  const title = document.createElement("div");
  title.textContent = "Promote this post";
  title.style.cssText = "font-size:16px;font-weight:600";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.style.cssText =
    "background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px;border-radius:6px;";
  closeBtn.addEventListener("click", closePromotionModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  // Info
  const normalizedId = extractIdFromRef(postId || "") || postId || "";
  const info = document.createElement("div");
  info.style.cssText =
    "font-size:13px;color:#cbd5e1;margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  const idLabel = document.createElement("div");
  const displayPostId = normalizedId || "unknown";
  idLabel.innerHTML = `Post ID: <code style="color:#e2e8f0;background:rgba(148,163,184,.15);padding:2px 6px;border-radius:6px;">${displayPostId}</code>`;
  info.appendChild(document.createTextNode("To promote this post"));
  info.appendChild(idLabel);

  // Single-task column form
  const form = document.createElement("div");
  form.style.cssText = "display:flex;flex-direction:column;gap:12px;";

  const fieldStyle = "display:flex;flex-direction:column;gap:6px;";
  const labelStyle = "font-size:12px;color:#94a3b8;";
  const inputStyle =
    "background:#0b0d12;color:#e5e7eb;border:1px solid rgba(148,163,184,.25);border-radius:8px;padding:8px 10px;outline:none;";

  // Focus/active styling for inputs/selects
  const attachFocusStyles = (el: HTMLInputElement | HTMLSelectElement) => {
    el.addEventListener("focus", () => {
      el.style.border = "1px solid rgba(234,88,12,.9)";
      el.style.boxShadow = "0 0 0 3px rgba(234,88,12,.3)";
    });
    el.addEventListener("blur", () => {
      el.style.border = "1px solid rgba(148,163,184,.25)";
      el.style.boxShadow = "none";
    });
  };

  // Task (segmented control)
  type PromotionTask = "repost" | "quote" | "comment";
  let selectedTask: PromotionTask = "repost";
  const taskField = document.createElement("div");
  taskField.style.cssText = fieldStyle;
  const taskLabel = document.createElement("label");
  taskLabel.textContent = "Task";
  taskLabel.style.cssText = labelStyle;
  const taskGroup = document.createElement("div");
  taskGroup.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  const makeTaskBtn = (val: PromotionTask, text: string, active = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.dataset.value = val;
    b.style.cssText =
      "padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.25);background:#0b0d12;color:#e5e7eb;cursor:pointer;";
    const setActive = (on: boolean) => {
      b.style.border = on
        ? "1px solid rgba(234,88,12,.85)"
        : "1px solid rgba(148,163,184,.25)";
      b.style.background = on
        ? "linear-gradient(90deg, #f97316, #ea580c)"
        : "#0b0d12";
    };
    setActive(active);
    b.addEventListener("click", () => {
      selectedTask = val;
      Array.from(taskGroup.querySelectorAll("button")).forEach((el) => {
        const on = (el as HTMLButtonElement).dataset.value === val;
        (el as HTMLButtonElement).style.border = on
          ? "1px solid rgba(234,88,12,.85)"
          : "1px solid rgba(148,163,184,.25)";
        (el as HTMLButtonElement).style.background = on
          ? "linear-gradient(90deg, #f97316, #ea580c)"
          : "#0b0d12";
      });
      toggleMessageField();
    });
    return b;
  };
  taskGroup.appendChild(makeTaskBtn("repost", "Repost", true));
  taskGroup.appendChild(makeTaskBtn("quote", "Quote"));
  taskGroup.appendChild(makeTaskBtn("comment", "Comment"));
  taskField.appendChild(taskLabel);
  taskField.appendChild(taskGroup);

  // Reward Token Selector
  let rewardTokenOptions: any[] = [];
  let selectedRewardToken: any = {
    tokenAddress: ARENA_TOKEN_ADDRESS,
    symbol: "ARENA",
    decimals: ARENA_TOKEN_DECIMALS,
  };

  const tokenField = document.createElement("div");
  tokenField.style.cssText = fieldStyle;
  const tokenLabel = document.createElement("label");
  tokenLabel.textContent = "Reward Token";
  tokenLabel.style.cssText = labelStyle;

  const tokenSelectWrap = document.createElement("div");
  tokenSelectWrap.style.cssText = "position:relative;";

  const tokenSelectBtn = document.createElement("button");
  tokenSelectBtn.type = "button";
  tokenSelectBtn.style.cssText = inputStyle + "width:100%;display:flex;align-items:center;justify-content:space-between;cursor:pointer;";

  const tokenSelectLabel = document.createElement("span");
  tokenSelectLabel.textContent = "ARENA (Default)";

  const tokenSelectIcon = document.createElement("span");
  tokenSelectIcon.textContent = "▼";
  tokenSelectIcon.style.cssText = "font-size:10px;color:#94a3b8;transition:transform 0.2s;";

  tokenSelectBtn.appendChild(tokenSelectLabel);
  tokenSelectBtn.appendChild(tokenSelectIcon);

  const tokenDropdown = document.createElement("div");
  tokenDropdown.style.cssText = "position:absolute;top:calc(100% + 4px);left:0;right:0;background:#0b0d12;border:1px solid rgba(148,163,184,.25);border-radius:8px;max-height:200px;overflow-y:auto;display:none;z-index:10;";

  let tokenMenuOpen = false;

  const updateTokenLabel = () => {
    const symbol = selectedRewardToken.symbol || "ARENA";
    const isDefault = selectedRewardToken.tokenAddress?.toLowerCase() === ARENA_TOKEN_ADDRESS.toLowerCase();
    tokenSelectLabel.textContent = isDefault ? `${symbol} (Default)` : symbol;

    // Update amount label and suffix
    amountLabel.textContent = `Amount (Total in ${symbol})`;
    amountSuffix.textContent = symbol;
  };

  const fetchAndPopulateTokens = async () => {
    try {
      // Get wallet address from background using GET_APP_STATE
      let walletAddress: string | null = null;
      try {
        const appState = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: "GET_APP_STATE" }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[AREX] Failed to get app state:",
                chrome.runtime.lastError.message
              );
              resolve(null);
              return;
            }
            resolve(response || null);
          });
        });
        walletAddress = appState?.wallet?.address || null;
      } catch (e) {
        console.warn("[AREX] Failed to get wallet address:", e);
      }

      const tokens = await getActiveSubscribedTokens();
      const defaultToken = {
        tokenAddress: ARENA_TOKEN_ADDRESS,
        symbol: "ARENA",
        decimals: ARENA_TOKEN_DECIMALS,
        isDefault: true,
      };

      // Deduplicate: filter out any ARENA tokens from subscribed list
      // Check both address and symbol to be safe
      const uniqueSubscribed = tokens.filter((t: any) => {
        if (!t.tokenAddress) return false;
        const isArenaAddr = t.tokenAddress.toLowerCase() === ARENA_TOKEN_ADDRESS.toLowerCase();
        const isArenaSymbol = t.symbol === "ARENA";
        return !isArenaAddr && !isArenaSymbol;
      });

      rewardTokenOptions = [defaultToken, ...uniqueSubscribed];

      // Render token options
      tokenDropdown.innerHTML = "";

      // Fetch real-time balances for all tokens
      const balancePromises = rewardTokenOptions.map(async (token: any) => {
        if (!walletAddress) return { token, balance: "0" };

        try {
          // Use ethers to fetch balance directly from blockchain
          const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
          const ERC20_ABI = [
            {
              constant: true,
              inputs: [{ name: "owner", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              type: "function",
            },
          ];

          const contract = new ethers.Contract(token.tokenAddress, ERC20_ABI, provider);
          const balance = await contract.balanceOf(walletAddress);
          const decimals = token.decimals || 18;
          const formatted = ethers.formatUnits(balance, decimals);
          return { token, balance: formatted };
        } catch (e) {
          console.warn(`[AREX] Failed to fetch balance for ${token.symbol}:`, e);
          return { token, balance: "0" };
        }
      });

      const balances = await Promise.all(balancePromises);

      balances.forEach(({ token, balance }) => {
        const option = document.createElement("div");
        option.style.cssText = "padding:10px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(148,163,184,.1);";

        const tokenInfo = document.createElement("div");
        tokenInfo.style.cssText = "display:flex;flex-direction:column;gap:2px;";

        const tokenName = document.createElement("div");
        tokenName.style.cssText = "font-size:13px;color:#e5e7eb;font-weight:500;";
        const symbol = token.symbol || "Unknown";
        const isDefault = token.isDefault;
        tokenName.textContent = isDefault ? `${symbol} (Default)` : symbol;

        const tokenAddr = document.createElement("div");
        tokenAddr.style.cssText = "font-size:11px;color:#64748b;";
        const shortAddr = token.tokenAddress ? `${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}` : "";
        tokenAddr.textContent = shortAddr;

        tokenInfo.appendChild(tokenName);
        tokenInfo.appendChild(tokenAddr);

        // Show real-time balance
        const balanceDiv = document.createElement("div");
        balanceDiv.style.cssText = "font-size:12px;color:#94a3b8;font-weight:500;";
        balanceDiv.textContent = `${parseFloat(balance).toFixed(2)}`;

        option.appendChild(tokenInfo);
        option.appendChild(balanceDiv);

        option.addEventListener("mouseenter", () => {
          option.style.background = "rgba(148,163,184,.15)";
        });
        option.addEventListener("mouseleave", () => {
          option.style.background = "transparent";
        });
        option.addEventListener("click", () => {
          selectedRewardToken = token;
          updateTokenLabel();
          tokenMenuOpen = false;
          tokenDropdown.style.display = "none";
          tokenSelectIcon.style.transform = "rotate(0deg)";
        });

        tokenDropdown.appendChild(option);
      });
    } catch (err) {
      console.error("[AREX] Failed to fetch reward tokens:", err);
      // Fallback to ARENA only
      rewardTokenOptions = [{
        tokenAddress: ARENA_TOKEN_ADDRESS,
        symbol: "ARENA",
        decimals: ARENA_TOKEN_DECIMALS,
        isDefault: true,
      }];
    }
  };

  tokenSelectBtn.addEventListener("click", () => {
    tokenMenuOpen = !tokenMenuOpen;
    tokenDropdown.style.display = tokenMenuOpen ? "block" : "none";
    tokenSelectIcon.style.transform = tokenMenuOpen ? "rotate(180deg)" : "rotate(0deg)";
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!tokenSelectWrap.contains(e.target as Node)) {
      tokenMenuOpen = false;
      tokenDropdown.style.display = "none";
      tokenSelectIcon.style.transform = "rotate(0deg)";
    }
  });

  tokenSelectWrap.appendChild(tokenSelectBtn);
  tokenSelectWrap.appendChild(tokenDropdown);
  tokenField.appendChild(tokenLabel);
  tokenField.appendChild(tokenSelectWrap);

  // Fetch tokens on modal load
  fetchAndPopulateTokens();

  // Slots
  const slotsField = document.createElement("div");
  slotsField.style.cssText = fieldStyle;
  const slotsLabel = document.createElement("label");
  slotsLabel.textContent = "Slots";
  slotsLabel.style.cssText = labelStyle;
  const slotsInput = document.createElement("input");
  slotsInput.type = "number";
  slotsInput.min = "1";
  slotsInput.value = "1";
  slotsInput.style.cssText = inputStyle;
  attachFocusStyles(slotsInput);
  slotsField.appendChild(slotsLabel);
  slotsField.appendChild(slotsInput);

  // Amount
  const amountField = document.createElement("div");
  amountField.style.cssText = fieldStyle;
  const amountLabel = document.createElement("label");
  amountLabel.textContent = "Amount (Total in ARENA)";
  amountLabel.style.cssText = labelStyle;
  const amountWrap = document.createElement("div");
  amountWrap.style.cssText = "position:relative;";
  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = "100";
  amountInput.step = "1";
  amountInput.placeholder = "100.00";
  amountInput.value = "100";
  amountInput.style.cssText = inputStyle + "padding-right:64px;";
  attachFocusStyles(amountInput);
  const amountSuffix = document.createElement("span");
  amountSuffix.textContent = "ARENA";
  amountSuffix.style.cssText =
    "position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:#94a3b8;";
  amountWrap.appendChild(amountInput);
  amountWrap.appendChild(amountSuffix);
  amountField.appendChild(amountLabel);
  amountField.appendChild(amountWrap);

  // Min followers
  const minField = document.createElement("div");
  minField.style.cssText = fieldStyle;
  const minLabel = document.createElement("label");
  minLabel.textContent = "Minimum followers";
  minLabel.style.cssText = labelStyle;
  const minInput = document.createElement("input");
  minInput.type = "number";
  minInput.min = "100";
  minInput.placeholder = "100";
  minInput.value = "100";
  minInput.style.cssText = inputStyle;
  attachFocusStyles(minInput);
  minField.appendChild(minLabel);
  minField.appendChild(minInput);

  // Likes Mandatory Toggle
  let likesMandatory = true; // Default to true like app-store

  const likesField = document.createElement("div");
  likesField.style.cssText = fieldStyle;

  const likesToggleRow = document.createElement("div");
  likesToggleRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(148,163,184,.08);border-radius:8px;border:1px solid rgba(148,163,184,.15);";

  const likesLabelWrap = document.createElement("div");
  likesLabelWrap.style.cssText = "display:flex;flex-direction:column;gap:2px;";

  const likesTitle = document.createElement("div");
  likesTitle.textContent = "Require Like";
  likesTitle.style.cssText = "font-size:13px;font-weight:600;color:#e5e7eb;";

  const likesDesc = document.createElement("div");
  likesDesc.textContent = "Users must like the post to verify.";
  likesDesc.style.cssText = "font-size:11px;color:#94a3b8;";

  likesLabelWrap.appendChild(likesTitle);
  likesLabelWrap.appendChild(likesDesc);

  const likesToggle = document.createElement("button");
  likesToggle.type = "button";
  likesToggle.style.cssText = "position:relative;display:inline-flex;height:28px;width:48px;flex-shrink:0;cursor:pointer;border-radius:9999px;border:2px solid transparent;transition:all 0.2s ease;background:#6366f1;";

  const likesToggleCircle = document.createElement("span");
  likesToggleCircle.style.cssText = "pointer-events:none;display:inline-block;height:24px;width:24px;transform:translateX(20px);border-radius:9999px;background:white;box-shadow:0 2px 4px rgba(0,0,0,0.3);transition:transform 0.2s ease;";

  likesToggle.appendChild(likesToggleCircle);

  likesToggle.addEventListener("click", () => {
    likesMandatory = !likesMandatory;
    if (likesMandatory) {
      likesToggle.style.background = "#6366f1";
      likesToggleCircle.style.transform = "translateX(20px)";
    } else {
      likesToggle.style.background = "#475569";
      likesToggleCircle.style.transform = "translateX(0)";
    }
  });

  likesToggleRow.appendChild(likesLabelWrap);
  likesToggleRow.appendChild(likesToggle);
  likesField.appendChild(likesToggleRow);

  // Expires (Duration vs Date & Time)
  const expField = document.createElement("div");
  expField.style.cssText = fieldStyle;
  const expLabel = document.createElement("label");
  expLabel.textContent = "Expires";
  expLabel.style.cssText = labelStyle;
  const expModeGroup = document.createElement("div");
  expModeGroup.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  let expMode: "duration" | "datetime" = "duration";
  const makeModeBtn = (
    val: "duration" | "datetime",
    text: string,
    active = false
  ) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.dataset.value = val;
    b.style.cssText =
      "padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.25);background:#0b0d12;color:#e5e7eb;cursor:pointer;";
    const setActive = (on: boolean) => {
      b.style.border = on
        ? "1px solid rgba(234,88,12,.85)"
        : "1px solid rgba(148,163,184,.25)";
      b.style.background = on
        ? "linear-gradient(90deg, #f97316, #ea580c)"
        : "#0b0d12";
    };
    setActive(active);
    b.addEventListener("click", () => {
      expMode = val;
      setActive(true);
      Array.from(expModeGroup.querySelectorAll("button")).forEach((el) => {
        if (el === b) return;
        (el as HTMLButtonElement).style.border =
          "1px solid rgba(148,163,184,.25)";
        (el as HTMLButtonElement).style.background = "#0b0d12";
      });
      durationWrap.style.display = val === "duration" ? "flex" : "none";
      dateWrap.style.display = val === "datetime" ? "flex" : "none";
    });
    return b;
  };
  expModeGroup.appendChild(makeModeBtn("duration", "Duration", true));
  expModeGroup.appendChild(makeModeBtn("datetime", "Date & Time"));

  // Duration controls
  const durationWrap = document.createElement("div");
  durationWrap.style.cssText =
    "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  const expNum = document.createElement("input");
  expNum.type = "number";
  expNum.min = "1";
  expNum.value = "24";
  expNum.style.cssText = inputStyle;
  attachFocusStyles(expNum);
  const unitSel = document.createElement("select");
  unitSel.style.cssText = inputStyle;
  ["minutes", "hours", "days"].forEach((u) => {
    const o = document.createElement("option");
    o.value = u;
    o.textContent = u[0].toUpperCase() + u.slice(1);
    unitSel.appendChild(o);
  });
  unitSel.value = "hours";
  attachFocusStyles(unitSel as HTMLSelectElement);
  durationWrap.appendChild(expNum);
  durationWrap.appendChild(unitSel);

  // Date & time control
  const dateWrap = document.createElement("div");
  dateWrap.style.cssText = "display:none;";
  const expDate = document.createElement("input");
  expDate.type = "datetime-local";
  // set min to now and default to now + 24h
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalDT = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };
  const now = new Date();
  const plus24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  expDate.min = toLocalDT(now);
  expDate.value = toLocalDT(plus24);
  expDate.style.cssText = inputStyle;
  attachFocusStyles(expDate);
  dateWrap.appendChild(expDate);

  expField.appendChild(expLabel);
  expField.appendChild(expModeGroup);
  expField.appendChild(durationWrap);
  expField.appendChild(dateWrap);

  // Optional message for quote/comment
  const messageField = document.createElement("div");
  messageField.style.cssText = "display:none;flex-direction:column;gap:6px;";
  const messageLabel = document.createElement("label");
  messageLabel.textContent = "Promotion content";
  messageLabel.style.cssText = labelStyle;
  const messageTextarea = document.createElement("textarea");
  messageTextarea.rows = 3;
  messageTextarea.placeholder = "Write a custom message for your promotion";
  messageTextarea.style.cssText =
    inputStyle + "min-height:72px;resize:vertical;";
  messageTextarea.addEventListener("focus", () => {
    messageTextarea.style.border = "1px solid rgba(234,88,12,.9)";
    messageTextarea.style.boxShadow = "0 0 0 3px rgba(234,88,12,.3)";
  });
  messageTextarea.addEventListener("blur", () => {
    messageTextarea.style.border = "1px solid rgba(148,163,184,.25)";
    messageTextarea.style.boxShadow = "none";
  });
  messageField.appendChild(messageLabel);
  messageField.appendChild(messageTextarea);

  function toggleMessageField() {
    if (selectedTask === "comment" || selectedTask === "quote") {
      messageField.style.display = "flex";
    } else {
      messageField.style.display = "none";
      messageTextarea.value = "";
    }
  }
  toggleMessageField();

  form.appendChild(taskField);
  form.appendChild(tokenField);
  form.appendChild(messageField);
  form.appendChild(slotsField);
  form.appendChild(amountField);
  form.appendChild(minField);
  form.appendChild(likesField);
  form.appendChild(expField);

  // Footer
  const footer = document.createElement("div");
  footer.style.cssText =
    "display:flex;justify-content:flex-end;gap:8px;margin-top:12px;";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.style.cssText =
    "background:transparent;border:1px solid rgba(148,163,184,.3);color:#cbd5e1;padding:8px 12px;border-radius:8px;cursor:pointer;";
  cancel.addEventListener("click", closePromotionModal);
  const save = document.createElement("button");
  save.style.cssText =
    "background:linear-gradient(90deg, #f97316, #ea580c);border:1px solid rgba(234,88,12,.85);color:white;padding:8px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;min-height:40px;";
  const saveLabel = document.createElement("span");
  saveLabel.textContent = "Start Promotion";
  const saveSpinner = createSpinner(16);
  saveSpinner.style.display = "none";
  saveSpinner.style.border = "3px solid rgba(255,255,255,.25)";
  saveSpinner.style.borderTopColor = "#fff";
  saveSpinner.style.width = "16px";
  saveSpinner.style.height = "16px";
  saveSpinner.style.marginLeft = "2px";
  save.appendChild(saveLabel);
  save.appendChild(saveSpinner);

  const setSaveLoading = (loading: boolean) => {
    if (!loading && !save.isConnected) {
      return;
    }
    if (loading) {
      save.dataset.loading = "1";
      saveSpinner.style.display = "inline-flex";
      saveLabel.textContent = "Submitting...";
      save.disabled = true;
      save.style.opacity = "0.85";
      save.style.cursor = "wait";
    } else {
      save.dataset.loading = "0";
      saveSpinner.style.display = "none";
      saveLabel.textContent = "Start Promotion";
      save.disabled = false;
      save.style.opacity = "1";
      save.style.cursor = "pointer";
    }
  };
  setSaveLoading(false);
  // Tag the button so we can update it from setEngagePromotion
  save.setAttribute("data-arex-save", "1");
  save.addEventListener("click", async () => {
    if (save.dataset.loading === "1") {
      console.warn("[AREX] Start Promotion clicked while already submitting");
      return;
    }

    setSaveLoading(true);
    let approvalReserved = false;
    const sessionContextId = generateCreatePromotionContextId();

    // Guard: require unlocked wallet before creating a promotion
    try {
      const walletStatus = await getWalletStatus();
      if (!walletStatus) {
        showToast("Failed to check wallet status. Please try again.");
        setSaveLoading(false);
        return;
      }
      if (!walletStatus.isUnlocked) {
        showToast("Wallet is locked. Please unlock your wallet first.");
        const unlocked = await promptAndWaitForWalletUnlock();
        if (!unlocked) {
          showToast("Wallet unlock was cancelled or timed out.");
          setSaveLoading(false);
          return;
        }
      }
    } catch (e) {
      showToast("Failed to check wallet status. Please try again.");
      setSaveLoading(false);
      return;
    }

    let expiresOn = 0;
    if (expMode === "duration") {
      const n = Math.max(1, Number(expNum.value || "0"));
      const unit = (unitSel.value || "hours") as "minutes" | "hours" | "days";
      const multiplier =
        unit === "minutes" ? 60 : unit === "hours" ? 3600 : 86400;
      expiresOn = Math.floor(Date.now() / 1000) + n * multiplier;
    } else {
      if (!expDate.value) {
        showToast("Please select an expiration date & time");
        setSaveLoading(false);
        return;
      }
      expiresOn = Math.floor(new Date(expDate.value).getTime() / 1000);
    }

    const slots = Number(slotsInput.value || "0");
    const amount = Number(amountInput.value || "0");
    const minFollowers = Number(minInput.value || "0");

    if (amount < 100) {
      showToast("Minimum amount is 100 ARENA");
      (amountInput as HTMLInputElement).focus();
      setSaveLoading(false);
      return;
    }

    const typeMap: Record<PromotionTask, number> = {
      comment: 0,
      repost: 1,
      quote: 2,
    };
    const promotionType = typeMap[selectedTask];

    try {
      // Build content data for Comment/Quote promotions
      let contentRaw = "";
      if (selectedTask === "comment" || selectedTask === "quote") {
        contentRaw = messageTextarea.value.trim();
        if (!contentRaw) {
          showToast("Please enter the promotion content for comment/quote.");
          setSaveLoading(false);
          return;
        }
      }

      // Upload metadata to Grove for ALL promotion types
      // For reposts: content is empty string, but still upload likesMandatory/require_like
      // For comment/quote: content is user-entered text
      let contentURI = "";
      const metadata = {
        app: "arena-plus",
        kind: "promotion-content",
        task: selectedTask,
        postId: normalizedId,
        content: contentRaw, // empty string for repost, user text for comment/quote
        createdAt: new Date().toISOString(),
        version: 1,
        likesMandatory: likesMandatory,
        require_like: likesMandatory,
      };

      try {
        // Convert metadata to base64 data URI
        const jsonString = JSON.stringify(metadata);
        const base64Data = btoa(jsonString);
        contentURI = `data:application/json;base64,${base64Data}`;
      } catch (e: any) {
        console.error("[AREX] Failed to encode content:", e);
        showToast("Failed to prepare content. Please try again.");
        setSaveLoading(false);
        return;
      }

      // Use normalized ID for payload and messages
      const arenaUserId = getArenaUserId();
      if (!arenaUserId) {
        showToast("Could not find user ID. Please log in again.");
        setSaveLoading(false);
        return;
      }

      // Get reward token symbol for display
      const rewardTokenSymbol = selectedRewardToken.symbol || "ARENA";

      // Request wallet approval before creating promotion
      const approvalData = {
        contextId: sessionContextId,
        promotionType,
        slots,
        amount,
        minFollowers,
        expiresOn,
        postId: normalizedId,
        contentURI,
        rewardTokenAddress: selectedRewardToken.tokenAddress,
        rewardTokenSymbol,
        arenaUserId,
      };

      showToast("Awaiting wallet approval...");

      const approvalPromise = waitForCreatePromotionApproval(sessionContextId);
      const approvalRequested = await requestCreatePromotionApproval(
        sessionContextId,
        approvalData
      );

      if (!approvalRequested) {
        failCreatePromotionApproval(
          sessionContextId,
          "Failed to initiate wallet approval."
        );
        showToast("Failed to initiate wallet approval.");
        setSaveLoading(false);
        return;
      }

      try {
        await approvalPromise;
        approvalReserved = true;
      } catch (approvalError: any) {
        const errorMessage =
          approvalError?.message || "Wallet approval was rejected.";
        showToast(errorMessage);
        setSaveLoading(false);
        return;
      }

      // Build payload with contextId for background to use approved data
      const payload: any = {
        contextId: sessionContextId,
        promotionType,
        slots: slots,
        amount: amount,
        minFollowers,
        expiresOn,
        postId: normalizedId,
        contentURI,
        content: contentRaw,
        arenaUserId,
        rewardTokenAddress: selectedRewardToken.tokenAddress,
      };

      console.log("[AREX] Start Promotion clicked, sending payload", payload);
      showToast("Submitting promotion...");
      await createPromotion(payload);
      showToast(
        `Promotion started${normalizedId ? ` for ${normalizedId}` : ""}`
      );
      closePromotionModal();
    } catch (err) {
      console.error("[AREX] Promotion failed", err);
      showToast("Failed to create promotion");
      if (approvalReserved) {
        await cancelCreatePromotionApproval(
          sessionContextId,
          "Promotion creation failed"
        ).catch(() => undefined);
      }
    } finally {
      setSaveLoading(false);
    }
  });

  modal.appendChild(header);
  modal.appendChild(info);
  modal.appendChild(form);
  modal.appendChild(footer);
  footer.appendChild(cancel);
  footer.appendChild(save);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") closePromotionModal();
  };
  (overlay as any)._arexOnKey = onKey;
  document.addEventListener("keydown", onKey);
}

function findMenuItemClass(menu: HTMLElement): string | null {
  // Try to reuse the className of an existing item for styling consistency
  const candidates = Array.from(
    menu.querySelectorAll(
      "a[role='menuitem'], button[role='menuitem'], [role='menuitem'], a, button, div"
    )
  ) as HTMLElement[];
  for (const node of candidates) {
    const t = (node.textContent || "").trim();
    if (/Copy link|Copy Text|Report Post|Post Reactions/i.test(t)) {
      return node.className || null;
    }
  }
  // Fallback: use the first element that already has a class name
  const fallback = candidates.find(
    (n) => (n.className || "").trim().length > 0
  );
  return fallback ? fallback.className || null : null;
}

function createPromotionItem(menu: HTMLElement): HTMLElement {
  const item = document.createElement("div");
  item.className = findMenuItemClass(menu) || "promotion-menu-item";
  item.setAttribute("data-arex-promotion-item", "1");
  item.style.display = item.className ? item.style.display : "flex";
  item.style.alignItems = item.className ? item.style.alignItems : "center";
  item.style.gap = item.className ? item.style.gap : "10px";
  item.style.padding = item.className ? item.style.padding : "10px 12px";
  item.style.cursor = item.className ? item.style.cursor : "pointer";
  item.style.borderRadius = item.className ? item.style.borderRadius : "8px";
  item.style.userSelect = "none";

  // Icon + label
  item.innerHTML = `
    <div class="arex-promo-icon" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;color:#94a3b8;">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <!-- Trending up icon -->
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    </div>
    <span class="arex-promo-text" style="font-size:14px;font-weight:500;">Promote</span>
  `;

  item.style.transition = "background 160ms ease, box-shadow 160ms ease";
  item.addEventListener("mouseenter", () => {
    // Requested hover color
    const hoverBg = "hsla(0, 0%, 100%, .1)";
    item.style.background = hoverBg;
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = "transparent";
  });

  item.addEventListener("click", async (e) => {
    e.preventDefault();
    // Prefer the full link; fall back to clipboard, then to legacy id extraction
    let postRef: string | null = extractPostLinkFromMenu(menu);
    if (!postRef) {
      postRef = await getPostLinkViaClipboard(menu);
    }
    if (!postRef) {
      postRef = extractPostIdFromMenu(menu);
    }
    // Close the Radix menu (simulate ESC), then open modal
    setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          bubbles: true,
        } as any)
      );
      const normalized = extractIdFromRef(postRef || "") || postRef;
      openPromotionModal(normalized);
    }, 0);
  });

  return item;
}

// Removed legacy post-menu Show Promotions injection. We now inject a text-only
// "Show Promotions" entry into the left sidebar More menu instead.

// A text-only entry suitable for the sidebar "More" menu
// Note: Previously there was a helper to inject into the More dropdown. We now prefer a persistent sidebar item.

function insertPromotionInto(menuContainer: HTMLElement) {
  const hasPromo = !!menuContainer.querySelector(
    '[data-arex-promotion-item="1"]'
  );
  // If a Show Promotions item is present in the post menu, remove it (we now place it in the More menu only)
  const oldShow = menuContainer.querySelector(
    '[data-arex-show-promotions-item="1"]'
  );
  if (oldShow) oldShow.remove();
  if (hasPromo) return;

  // Insert as the FIRST item in the menu
  const allNodes = Array.from(
    menuContainer.querySelectorAll("*")
  ) as HTMLElement[];
  const firstKnown = allNodes.find((n) =>
    /Post Reactions|Copy link|Copy Text|Report Post/i.test(
      (n.textContent || "").trim()
    )
  );

  const promo = createPromotionItem(menuContainer);

  if (firstKnown && firstKnown.parentElement) {
    firstKnown.parentElement.insertBefore(promo, firstKnown);
    return;
  }
  if (menuContainer.firstElementChild) {
    menuContainer.insertBefore(promo, menuContainer.firstElementChild);
    return;
  }
  menuContainer.appendChild(promo);
}

// (Deprecated) Previously injected into the More dropdown; now we add a sidebar item instead.

// Create a sidebar nav item (above the "More" button) that opens the Promotions list
function createShowPromotionsSidebarItem(): HTMLElement {
  const a = document.createElement("a");
  a.href = "#";
  a.className = "group py-1.5 text-gray-text opacity-100";
  a.setAttribute("data-arex-sidebar-show-promotions", "1");

  const wrap = document.createElement("div");
  wrap.className =
    "flex items-center justify-center gap-3 rounded-lg p-[10px] transition-colors group-hover:bg-gray-bg xl:justify-start";

  const iconWrap = document.createElement("div");
  iconWrap.className = "relative";
  iconWrap.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-6 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <!-- Lightning bolt icon (similar to BsLightning) -->
      <path d="M13 2 L3 14 H10 L9 22 L21 10 H14 L15 2 Z" />
    </svg>`;

  const label = document.createElement("span");
  label.className = "hidden text-base font-semibold leading-5 xl:inline";
  label.textContent = "Promotions";

  wrap.appendChild(iconWrap);
  wrap.appendChild(label);
  a.appendChild(wrap);

  a.addEventListener("click", (e) => {
    e.preventDefault();
    openPromotionsListModal();
  });

  return a;
}

// Insert the sidebar item immediately above the "More" button
function insertShowPromotionsIntoSidebar(moreBtn: HTMLElement) {
  const parent = moreBtn.parentElement as HTMLElement | null;
  if (!parent) return;
  const existing = parent.querySelector(
    '[data-arex-sidebar-show-promotions="1"]'
  );
  if (existing) return;
  const item = createShowPromotionsSidebarItem();
  parent.insertBefore(item, moreBtn);
}

function scanAndInject() {
  if (!isArenaSite()) return;
  const candidates = Array.from(
    document.querySelectorAll(
      '[id^="radix-"], [data-radix-popper-content-wrapper]'
    )
  ) as HTMLElement[];
  for (const el of candidates) {
    if (isTargetMenu(el)) {
      // Some Radix menus wrap content in an inner div; choose deepest with menu text
      const inner = el.querySelector(
        '[role="menu"], div'
      ) as HTMLElement | null;
      insertPromotionInto(inner || el);
    }
  }

  // Also inject a persistent sidebar nav item above the "More" button
  const moreButtons = Array.from(
    document.querySelectorAll('button[aria-haspopup="menu"]')
  ) as HTMLElement[];
  for (const btn of moreButtons) {
    const txt = (btn.textContent || "").trim();
    if (/^More$/i.test(txt) || /\bMore\b/i.test(txt)) {
      insertShowPromotionsIntoSidebar(btn);
    }
  }
}

function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        const el = node as Element;
        if (!(el instanceof HTMLElement)) continue;
        if (isTargetMenu(el)) {
          const inner = el.querySelector(
            '[role="menu"], div'
          ) as HTMLElement | null;
          if (inner) insertPromotionInto(inner);
        } else {
          const nested = el.querySelector(
            '[id^="radix-"], [data-radix-popper-content-wrapper]'
          ) as HTMLElement | null;
          if (nested && (isTargetMenu(nested) || isMoreMenu(nested))) {
            const inner = nested.querySelector(
              '[role="menu"], div'
            ) as HTMLElement | null;
            if (inner) {
              if (isTargetMenu(nested)) insertPromotionInto(inner);
            }
          }
        }

        // If a sidebar More button appears later, inject above it
        const btns = el.matches('button[aria-haspopup="menu"]')
          ? [el as HTMLElement]
          : Array.from(
            (el as HTMLElement).querySelectorAll(
              'button[aria-haspopup="menu"]'
            )
          );
        for (const b of btns) {
          const txt = (b.textContent || '').trim();
          if (/^More$/i.test(txt) || /\bMore\b/i.test(txt)) {
            insertShowPromotionsIntoSidebar(b as HTMLElement);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initPromotion(_engage?: boolean) {
  if (!isArenaSite()) return;
  registerCreatePromotionApprovalListener();
  ensureObserver();
  scanAndInject();
}

export function setEngagePromotion(_engage: boolean) {
  const save = document.querySelector(
    '#arex-promo-modal [data-arex-save="1"]'
  ) as HTMLButtonElement | null;
  if (save) {
    save.disabled = false;
    save.style.opacity = "1";
    save.style.cursor = "pointer";
    save.title = "";
  }
}

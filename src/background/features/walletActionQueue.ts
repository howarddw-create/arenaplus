import type { LogFn } from "../core/logger";

type WalletActionStatus = "queued" | "awaiting_user" | "processing";

export interface WalletActionMeta {
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  amount?: string;
  tokenSymbol?: string;
}

interface WalletActionQueueEntry {
  id: string;
  meta: WalletActionMeta;
  status: WalletActionStatus;
  perform: () => Promise<unknown>;
  sendResponse: (payload: unknown) => void;
}

export interface WalletActionQueueSummaryEntry {
  id: string;
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  amount?: string;
  tokenSymbol?: string;
  status: WalletActionStatus;
  position: number;
}

export interface WalletActionQueueApi {
  enqueue: (
    meta: WalletActionMeta,
    perform: () => Promise<unknown>,
    sendResponse: (payload: unknown) => void
  ) => string;
  getSummary: () => WalletActionQueueSummaryEntry[];
  respond: (id: string, approved: boolean) => { success: boolean; error?: string };
  cancelById: (id: string, reason: string) => boolean;
  rejectActive: (reason: string) => void;
  openPopup: () => Promise<void>;
}

const walletPopupSize = { width: 420, height: 640 };

export function createWalletActionQueue(log: LogFn): WalletActionQueueApi {
  let unlockWindowId: number | null = null;
  const walletActionQueue: WalletActionQueueEntry[] = [];

  const generateActionId = () =>
    (crypto as Crypto)?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const summarizeWalletQueue = (): WalletActionQueueSummaryEntry[] =>
    walletActionQueue.map((entry, index) => ({
      id: entry.id,
      title: entry.meta.title,
      description: entry.meta.description,
      details: entry.meta.details,
      amount: entry.meta.amount,
      tokenSymbol: entry.meta.tokenSymbol,
      status: entry.status,
      position: index,
    }));

  const notifyWalletActionQueue = () => {
    chrome.runtime.sendMessage({
      type: "WALLET_ACTION_QUEUE_UPDATED",
      queue: summarizeWalletQueue(),
    });
  };

  const closePopupWindow = () => {
    if (unlockWindowId == null) return;
    chrome.windows.get(unlockWindowId, (win) => {
      if (chrome.runtime.lastError) {
        unlockWindowId = null;
        return;
      }
      if (win) {
        chrome.windows.remove(unlockWindowId!, () => {
          unlockWindowId = null;
        });
      } else {
        unlockWindowId = null;
      }
    });
  };

  const openPopup = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = chrome.runtime.getURL("index.html");
      const focusExisting = () => {
        if (unlockWindowId == null) {
          createWindow();
          return;
        }
        chrome.windows.get(unlockWindowId, (win) => {
          if (chrome.runtime.lastError || !win) {
            unlockWindowId = null;
            createWindow();
            return;
          }
          chrome.windows.update(unlockWindowId!, { focused: true }, () => {
            if (chrome.runtime.lastError) {
              unlockWindowId = null;
              createWindow();
              return;
            }
            resolve();
          });
        });
      };

      const createWindow = () => {
        const createData: chrome.windows.CreateData = {
          url,
          type: "popup",
          width: walletPopupSize.width,
          height: walletPopupSize.height,
          focused: true,
        };
        const finalizeCreate = () => {
          chrome.windows.create(createData, (win) => {
            if (chrome.runtime.lastError || !win) {
              reject(
                new Error(
                  chrome.runtime.lastError?.message ||
                    "Failed to open wallet window"
                )
              );
              return;
            }
            unlockWindowId = win.id ?? null;
            resolve();
          });
        };
        const applyPositionFromAnchor = (anchor?: chrome.windows.Window | null) => {
          const margin = 24;
          if (
            anchor &&
            typeof anchor.left === "number" &&
            typeof anchor.width === "number"
          ) {
            const anchorRight = anchor.left + anchor.width;
            createData.left = Math.max(
              0,
              Math.round(anchorRight - walletPopupSize.width - margin)
            );
          }
          if (anchor && typeof anchor.top === "number") {
            createData.top = Math.max(0, Math.round(anchor.top + margin));
          }
        };
        const applyScreenFallback = () => {
          if (typeof screen === "undefined") return;
          try {
            const scr = screen as any;
            const availLeft =
              typeof scr?.availLeft === "number" ? scr.availLeft : 0;
            const availTop = typeof scr?.availTop === "number" ? scr.availTop : 0;
            const left =
              availLeft +
              Math.max(
                20,
                (scr?.availWidth || walletPopupSize.width) -
                  walletPopupSize.width -
                  40
              );
            createData.left = Math.max(0, Math.round(left));
            createData.top = Math.max(availTop + 60, 40);
          } catch {
            // ignore positioning errors
          }
        };

        if (chrome.windows?.getLastFocused) {
          chrome.windows.getLastFocused({ populate: false }, (anchorWindow) => {
            if (!chrome.runtime.lastError && anchorWindow) {
              applyPositionFromAnchor(anchorWindow);
            } else {
              applyScreenFallback();
            }
            finalizeCreate();
          });
        } else {
          applyScreenFallback();
          finalizeCreate();
        }
      };

      focusExisting();
    });
  };

  const advanceWalletQueue = () => {
    if (walletActionQueue.length > 0) {
      walletActionQueue[0].status = "awaiting_user";
    }
    notifyWalletActionQueue();
  };

  const cleanupWalletAction = (id: string) => {
    const idx = walletActionQueue.findIndex((entry) => entry.id === id);
    if (idx >= 0) {
      walletActionQueue.splice(idx, 1);
    }
    advanceWalletQueue();
    if (walletActionQueue.length === 0) {
      closePopupWindow();
    }
  };

  const rejectActive = (reason: string) => {
    const active = walletActionQueue[0];
    if (!active) return;
    active.sendResponse({ success: false, error: reason });
    cleanupWalletAction(active.id);
  };

  const cancelById = (id: string, reason: string) => {
    const entry = walletActionQueue.find((item) => item.id === id);
    if (!entry) return false;
    try {
      entry.sendResponse({ success: false, error: reason });
    } catch {
      // ignore failures when message channel already closed
    }
    cleanupWalletAction(id);
    return true;
  };

  const enqueue: WalletActionQueueApi["enqueue"] = (meta, perform, sendResponse) => {
    const entry: WalletActionQueueEntry = {
      id: generateActionId(),
      meta,
      perform,
      sendResponse,
      status: walletActionQueue.length === 0 ? "awaiting_user" : "queued",
    };
    walletActionQueue.push(entry);
    notifyWalletActionQueue();
    openPopup().catch((err) => log("Failed to open wallet popup:", err));
    return entry.id;
  };

  const respond: WalletActionQueueApi["respond"] = (id, approved) => {
    const entry = walletActionQueue.find((item) => item.id === id);
    if (!entry) {
      return { success: false, error: "Request not found." };
    }
    if (walletActionQueue[0]?.id !== entry.id) {
      return { success: false, error: "This request is not currently active." };
    }

    if (!approved) {
      entry.sendResponse({ success: false, error: "USER_REJECTED" });
      cleanupWalletAction(entry.id);
      return { success: true };
    }

    if (entry.status === "processing") {
      return { success: false, error: "Request already processing." };
    }

    entry.status = "processing";
    notifyWalletActionQueue();

    entry
      .perform()
      .then((result) => {
        entry.sendResponse(
          result ?? { success: true, error: undefined, txHash: undefined }
        );
      })
      .catch((err) => {
        entry.sendResponse({
          success: false,
          error: (err as any)?.message || "Transaction failed",
        });
      })
      .finally(() => {
        cleanupWalletAction(entry.id);
      });

    return { success: true };
  };

  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId !== unlockWindowId) return;
    unlockWindowId = null;
    if (walletActionQueue.length > 0) {
      rejectActive("USER_REJECTED_WINDOW_CLOSED");
    }
  });

  return {
    enqueue,
    getSummary: summarizeWalletQueue,
    respond,
    cancelById,
    rejectActive,
    openPopup,
  };
}


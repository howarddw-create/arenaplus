type PromotionApprovalWaiter = {
  timeoutId: number;
  resolve: () => void;
  reject: (err: Error) => void;
};

const createPromotionApprovalWaiters = new Map<string, PromotionApprovalWaiter>();
let createPromotionApprovalListenerRegistered = false;

function resolveCreatePromotionApproval(contextId?: string) {
  if (!contextId) return;
  const waiter = createPromotionApprovalWaiters.get(contextId);
  if (waiter) {
    clearTimeout(waiter.timeoutId);
    createPromotionApprovalWaiters.delete(contextId);
    waiter.resolve();
  }
}

function rejectCreatePromotionApproval(contextId?: string, error?: string) {
  if (!contextId) return;
  const waiter = createPromotionApprovalWaiters.get(contextId);
  if (waiter) {
    clearTimeout(waiter.timeoutId);
    createPromotionApprovalWaiters.delete(contextId);
    waiter.reject(new Error(error || "Wallet approval rejected."));
  }
}

export function failCreatePromotionApproval(contextId: string, error?: string) {
  rejectCreatePromotionApproval(contextId, error);
}

export function registerCreatePromotionApprovalListener() {
  if (createPromotionApprovalListenerRegistered) return;
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CREATE_PROMOTION_APPROVAL_GRANTED") {
      resolveCreatePromotionApproval(message.contextId);
      return;
    }
    if (message?.type === "CREATE_PROMOTION_APPROVAL_DENIED") {
      rejectCreatePromotionApproval(message.contextId, message.error);
      return;
    }
  });
  createPromotionApprovalListenerRegistered = true;
}

export function waitForCreatePromotionApproval(
  contextId: string,
  timeoutMs = 120_000
): Promise<void> {
  if (createPromotionApprovalWaiters.has(contextId)) {
    const existing = createPromotionApprovalWaiters.get(contextId);
    if (existing) {
      clearTimeout(existing.timeoutId);
      createPromotionApprovalWaiters.delete(contextId);
    }
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      createPromotionApprovalWaiters.delete(contextId);
      reject(new Error("Wallet approval timed out."));
    }, timeoutMs);

    createPromotionApprovalWaiters.set(contextId, {
      timeoutId,
      resolve: () => {
        clearTimeout(timeoutId);
        createPromotionApprovalWaiters.delete(contextId);
        resolve();
      },
      reject: (err: Error) => {
        clearTimeout(timeoutId);
        createPromotionApprovalWaiters.delete(contextId);
        reject(err);
      },
    });
  });
}

export function requestCreatePromotionApproval(
  contextId: string,
  promotionData: any
): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "REQUEST_CREATE_PROMOTION_APPROVAL",
        payload: {
          contextId,
          ...promotionData,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to request create promotion approval",
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

export function cancelCreatePromotionApproval(
  contextId: string,
  reason?: string
): Promise<void> {
  if (!contextId || typeof chrome === "undefined" || !chrome.runtime?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "CANCEL_CREATE_PROMOTION_APPROVAL",
        contextId,
        reason,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "Failed to cancel create promotion approval",
            chrome.runtime.lastError
          );
        }
        resolve();
      }
    );
  });
}

export const generateCreatePromotionContextId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

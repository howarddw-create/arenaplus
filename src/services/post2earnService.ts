import {
  CreatePromotionParams,
  CreatePromotionResult,
  EngageParams,
  PromotionsFilterOptions,
  PromoterPromotionFilter,
} from "../services/post2earn/types";

export type {
  EngageParams,
  EngageParamsOld,
  PromotionsSortKey,
  PromotionsFilterOptions,
  Promotion,
  Engagement,
  UnclaimedReward,
  CreatePromotionParams,
  CreatePromotionResult,
  ContractSource,
  PromoterPromotionFilter,
  SubscribedRewardToken,
  RewardTokenMetadata,
} from "./post2earn/types";

// Re-export the service from the index file
export { default } from "./post2earn";

// Keep existing functions that wrap chrome.runtime.sendMessage for backward compatibility
// or if they are used directly by components that haven't been migrated to the new service class yet.

export async function createPromotion(
  params: CreatePromotionParams
): Promise<CreatePromotionResult> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "CREATE_PROMOTION", payload: params },
        (response) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error("No response from background"));
            return;
          }

          if (response?.success) {
            resolve({
              transactionHash: response.txHash,
              promotionId: response.promotionId,
            });
          } else {
            reject(new Error(response?.error || "Failed to create promotion"));
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function uploadToGrove(metadata: any): Promise<{ uri: string }> {
  // Helper to build a stable data URI locally as a fallback
  const toDataUri = (obj: any): { uri: string } => {
    const json = JSON.stringify(obj ?? {}, null, 2);
    // Use base64 to avoid issues with special characters
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return { uri: `data:application/json;base64,${base64}` };
  };

  try {
    const response: any = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "UPLOAD_GROVE_JSON", payload: metadata },
          (resp) => {
            resolve({ resp, lastError: chrome.runtime?.lastError });
          }
        );
      } catch (err) {
        resolve({ err });
      }
    });

    if (
      !response?.lastError &&
      response?.resp?.success &&
      response?.resp?.uri
    ) {
      return { uri: response.resp.uri };
    }

    return toDataUri(metadata);
  } catch {
    return toDataUri(metadata);
  }
}

export async function fetchTextViaBackground(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "FETCH_TEXT", url }, (response) => {
        if (chrome.runtime?.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response?.success) {
          resolve(response.text || "");
        } else {
          reject(new Error(response?.error || "Failed to fetch text"));
        }
      });
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function engageInPromotion(params: EngageParams): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "ENGAGE_IN_PROMOTION", payload: params },
        (response) => {
          if (chrome.runtime?.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response) {
            return reject(new Error("No response from background"));
          }
          if (response.success) {
            resolve(response.txHash);
          } else {
            reject(
              new Error(response?.error || "Failed to engage in promotion")
            );
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function cancelPromotionTx(promotionId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "CANCEL_PROMOTION", payload: { promotionId } },
        (response) => {
          if (chrome.runtime?.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response) {
            return reject(new Error("No response from background"));
          }
          if (response.success) {
            resolve(response.txHash);
          } else {
            reject(new Error(response?.error || "Failed to cancel promotion"));
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function subscribeToToken(
  tokenAddress: string,
  arenaUserId: string,
  months: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "SUBSCRIBE_TO_TOKEN",
          payload: { tokenAddress, arenaUserId, months },
        },
        (response) => {
          if (chrome.runtime?.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response) {
            return reject(new Error("No response from background"));
          }
          if (response.success) {
            resolve(response.txHash);
          } else {
            reject(new Error(response?.error || "Failed to subscribe to token"));
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function repostThread(threadId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "REPOST_THREAD", payload: { threadId } },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || "Failed to repost thread"));
        }
      }
    );
  });
}

export async function getBearerToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_BEARER_TOKEN" }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response?.token) {
        resolve(response.token);
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        reject(new Error("Failed to get bearer token"));
      }
    });
  });
}

export async function fetchAllPromotions(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "FETCH_PROMOTIONS" }, (response) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error("No response from background"));
          return;
        }

        if (response.success) {
          resolve(response.data || []);
        } else {
          reject(new Error(response?.error || "Failed to fetch promotions"));
        }
      });
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function fetchPromotionsFiltered(
  options: PromotionsFilterOptions
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "FETCH_PROMOTIONS_FILTERED", payload: options },
        (response) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("No response from background"));
            return;
          }
          if (response.success) {
            resolve(response.data || []);
          } else {
            reject(new Error(response?.error || "Failed to fetch promotions"));
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export type MyPromotionsOptions = {
  offset?: number;
  limit?: number;
  newestFirst?: boolean;
  filter?: PromoterPromotionFilter;
};

export async function fetchMyPromotions(
  address: string,
  options?: MyPromotionsOptions
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "FETCH_MY_PROMOTIONS",
          payload: {
            address,
            options: {
              offset: options?.offset ?? 0,
              limit: options?.limit ?? 10,
              newestFirst: options?.newestFirst ?? true,
              filter: options?.filter ?? "all",
            },
          },
        },
        (response) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("No response from background"));
            return;
          }
          if (response.success) {
            resolve(response.data || []);
          } else {
            reject(
              new Error(response?.error || "Failed to fetch my promotions")
            );
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function getRewardTokenMetadata(
  tokenAddress: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "GET_REWARD_TOKEN_METADATA",
          payload: { tokenAddress },
        },
        (response) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("No response from background"));
            return;
          }
          if (response.success) {
            resolve(response.data);
          } else {
            reject(
              new Error(response?.error || "Failed to fetch token metadata")
            );
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}

export async function getActiveSubscribedTokens(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "GET_ACTIVE_SUBSCRIBED_TOKENS" },
        (response) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("No response from background"));
            return;
          }
          if (response.success) {
            resolve(response.data || []);
          } else {
            reject(
              new Error(response?.error || "Failed to fetch subscribed tokens")
            );
          }
        }
      );
    } catch (e: any) {
      reject(new Error(e?.message || "Failed to send message"));
    }
  });
}


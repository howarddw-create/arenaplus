import { showToast } from "../../utils/toast";

export interface EngageBackendParams {
  promotionId: string;
  engagementPostId: string;
  engagementType: "repost" | "comment" | "quote";
  threadData: any;
  promotionPostId: string;
  content?: string;
  followerCount?: number;
}

export async function callEngageBackend(params: EngageBackendParams): Promise<void> {
  const {
    promotionId,
    engagementPostId,
    engagementType,
    threadData,
    promotionPostId,
  } = params;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "ENGAGE_IN_PROMOTION",
        payload: {
          promotionId: promotionId.toString(),
          engagementPostId,
          engagementType,
          threadData,
          promotionPostId,
          content: (params as any).content,
          followerCount: (params as any).followerCount,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showToast(
            `[ERROR] Chrome runtime error: ${chrome.runtime.lastError.message}`
          );
          reject(
            new Error(`Runtime error: ${chrome.runtime.lastError.message}`)
          );
          return;
        }

        if (!response) {
          showToast("[ERROR] No response from background script");
          reject(new Error("No response from background script"));
          return;
        }

        if (response.success) {
          showToast("[SUCCESS] Backend engagement completed!");
          resolve();
        } else {
          showToast(`[ERROR] Backend engagement failed: ${response.error}`);
          reject(new Error(response.error || "Engagement failed"));
        }
      }
    );
  });
}


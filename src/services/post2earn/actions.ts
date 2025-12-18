import { ethers } from "ethers";
import Post2EarnABI from "../../contract/Post2EarnABI.json";
import LegacyPost2EarnABI from "../../contract/legacyPost2EarnABI.json";
import Post2EarnCA from "../../contract/Post2EarnCA.json";
import { ARENA_TOKEN_ADDRESS } from "../../utils/arenaToken";
import type {
  EngageParams,
  CreatePromotionParams,
  CreatePromotionResult,
} from "./types";
import { Post2EarnGetters } from "./getters";
import userService from "../userService";
import { decodeCorruptedUtf8 } from "../../utils/text";

const {
  POST2_EARN_CONTRACT_ADDRESS,
  LEGACY_POST2_EARN_CONTRACT_ADDRESS,
} = Post2EarnCA;

const PUBLIC_RPC = import.meta.env.VITE_AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

export class Post2EarnActions {
  private getters = new Post2EarnGetters();

  async repostThread(threadId: string): Promise<any> {
    return Promise.resolve({ success: true, threadId });
  }

  private async buildEngagementPayload(
    params: EngageParams,
    userAddress: string
  ) {
    // Get fresh follower count from API if twitterUsername is available
    let followerCount = params.followerCount ?? 100;
    let arenaUserId = params.arenaUserId ?? "";

    if (params.twitterUsername) {
      try {
        const freshUserData = await userService.fetchFreshFollowerCount(
          params.twitterUsername
        );
        if (freshUserData?.followerCount) {
          followerCount = freshUserData.followerCount;
        }
        if (freshUserData?.userId) {
          arenaUserId = freshUserData.userId;
        }
      } catch (error) {
        console.warn(
          "Failed to fetch fresh follower count, using fallback:",
          error
        );
      }
    }

    const promotion = await this.getters.getPromotionDetails(
      params.promotionId
    );

    if (promotion.minFollowers > 0 && followerCount < promotion.minFollowers) {
      const errorMsg = `Insufficient followers. Required: ${promotion.minFollowers}, Actual: ${followerCount}`;
      throw new Error(errorMsg);
    }

    let contentForEngagement = this.extractPromotionContent(params.content);

    if (!contentForEngagement && params.engagementType !== "repost") {
      try {
        const uri = promotion.contentURI;

        if (uri) {
          if (uri.startsWith("data:")) {
            const base64 = uri.split(",")[1] || "";
            const decoded = atob(base64);
            const extracted = this.extractPromotionContent(decoded);
            contentForEngagement = extracted || decoded;
          } else if (uri.startsWith("lens://")) {
            const key = uri.replace("lens://", "");
            const gw = `${import.meta.env.VITE_GROVE_API_URL}/${key}`;
            const res = await fetch(gw);
            if (res.ok) {
              const text = await res.text();
              const extracted = this.extractPromotionContent(text);
              contentForEngagement = extracted || text;
            }
          } else {
            const res = await fetch(uri);
            if (res.ok) {
              const text = await res.text();
              const extracted = this.extractPromotionContent(text);
              contentForEngagement = extracted || text;
            }
          }
        } else if (promotion.content) {
          const extracted = this.extractPromotionContent(promotion.content);
          contentForEngagement = extracted || promotion.content;
        }
      } catch (e) {
        console.warn(
          "Failed to resolve promotion content",
          e
        );
      }
    }

    if (!contentForEngagement && promotion.content) {
      const extracted = this.extractPromotionContent(promotion.content);
      contentForEngagement = extracted || promotion.content;
    }

    const twitterUsername = params.twitterUsername ?? "";

    const finalPayload = {
      promotionId: params.promotionId,
      promotionType: promotion.promotionType,
      twitterUsername,
      engagementPostId: params.engagementPostId,
      followerCount,
      engager: userAddress,
      loggedInUsername: twitterUsername,
      promotionPostId: params.promotionPostId,
      engagementType: params.engagementType,
      content: contentForEngagement,
      arenaUserId,
    };

    return {
      followerCount,
      contentForEngagement,
      payload: finalPayload,
      arenaUserId,
    };
  }

  async verifyEngagement(
    params: EngageParams,
    _userAddress: string
  ): Promise<{ success: boolean; message?: string; engagementId?: string }> {
    try {
      // Get fresh follower count from API if twitterUsername is available
      let followerCount = params.followerCount ?? 100;

      if (params.twitterUsername) {
        try {
          const freshUserData = await userService.fetchFreshFollowerCount(
            params.twitterUsername
          );
          if (freshUserData?.followerCount) {
            followerCount = freshUserData.followerCount;
          }
        } catch (error) {
          console.warn(
            "Failed to fetch fresh follower count, using fallback:",
            error
          );
        }
      }

      const promotion = await this.getters.getPromotionDetails(
        params.promotionId
      );
      if (
        promotion.minFollowers > 0 &&
        followerCount < promotion.minFollowers
      ) {
        throw new Error(
          `Insufficient followers. Required: ${promotion.minFollowers}, Actual: ${followerCount}`
        );
      }

      let contentForEngagement = params.content ?? "";
      if (!contentForEngagement && params.engagementType !== "repost") {
        try {
          const uri = promotion.contentURI;
          if (uri) {
            if (uri.startsWith("data:")) {
              const base64 = uri.split(",")[1] || "";
              const decoded = atob(base64);
              const extracted = this.extractPromotionContent(decoded);
              contentForEngagement = extracted || decoded;
            } else if (uri.startsWith("lens://")) {
              const key = uri.replace("lens://", "");
              const gw = `${import.meta.env.VITE_GROVE_API_URL}/${key}`;
              const res = await fetch(gw);
              if (res.ok) {
                const text = await res.text();
                const extracted = this.extractPromotionContent(text);
                contentForEngagement = extracted || text;
              }
            }
          }
        } catch (e) {
          console.warn("Failed to resolve promotion content", e);
        }
      }

      if (!contentForEngagement && promotion.content) {
        const extracted = this.extractPromotionContent(promotion.content);
        contentForEngagement = extracted || promotion.content;
      }

      const promotionType = promotion.promotionType;
      const promotionPostId = params.promotionPostId;
      const twitterUsername = params.twitterUsername || "";
      const requiredContent = contentForEngagement || "";

      let engagementId: string | null = null;

      // Get auth token for API calls
      const authToken = await this.getters.getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers.Authorization = authToken.startsWith("Bearer ")
          ? authToken
          : `Bearer ${authToken}`;
      }

      switch (promotionType) {
        case 1: // Repost
          engagementId = await this.verifyRepost(
            promotionPostId,
            twitterUsername,
            headers
          );
          break;
        case 2: // Quote
          engagementId = await this.verifyQuote(
            promotionPostId,
            twitterUsername,
            requiredContent,
            headers
          );
          break;
        case 0: // Comment
        default:
          engagementId = await this.verifyComment(
            promotionPostId,
            twitterUsername,
            requiredContent,
            headers
          );
          break;
      }

      if (!engagementId) {
        const typeLabel =
          this.getPromotionTypeLabel(promotionType).toLowerCase();
        throw new Error(
          `No valid ${typeLabel} found for user @${twitterUsername} on the specified post`
        );
      }

      // Check likes mandatory
      if (promotion.likesMandatory) {
        const arenaUserId = params.arenaUserId;
        const hasLiked = await this.verifyLike(
          promotionPostId,
          twitterUsername,
          headers,
          arenaUserId
        );
        if (!hasLiked) {
          throw new Error(
            `You must like the post to verify this promotion.`
          );
        }
      }

      return {
        success: true,
        message: `Engagement verified successfully! Found ${this.getPromotionTypeLabel(
          promotionType
        ).toLowerCase()} by @${twitterUsername}`,
        engagementId,
      };
    } catch (error: any) {
      throw new Error(error?.message || "Failed to verify engagement");
    }
  }

  private getPromotionTypeLabel(type: number): string {
    switch (type) {
      case 0:
        return "Comment";
      case 1:
        return "Repost";
      case 2:
        return "Quote";
      default:
        return "Unknown";
    }
  }

  private normalizeContent(rawContent?: string): string {
    if (!rawContent) {
      return "";
    }

    const decoded = this.decodeHtmlEntities(rawContent);

    return decoded
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private decodeHtmlEntities(value: string): string {
    if (!value) {
      return "";
    }

    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined"
    ) {
      const textarea = window.document.createElement("textarea");
      textarea.innerHTML = value;
      return textarea.value;
    }

    return value
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#x2f;/gi, "/");
  }

  private extractPromotionContent(rawContent?: string | null): string {
    if (!rawContent) {
      return "";
    }

    let content = rawContent;

    try {
      const parsed = JSON.parse(rawContent);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.content === "string"
      ) {
        content = parsed.content;
      }
    } catch {
      // Not JSON
    }

    const utf8Decoded = decodeCorruptedUtf8(content);
    const htmlDecoded = this.decodeHtmlEntities(utf8Decoded);

    return htmlDecoded.trim();
  }

  private collectHandles(candidate: any): string[] {
    const handles = [
      candidate?.handle,
      candidate?.userHandle,
      candidate?.twitterHandle,
      candidate?.user?.handle,
      candidate?.user?.userHandle,
      candidate?.user?.twitterHandle,
    ];

    return handles
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
      .map((value) => value.toLowerCase());
  }

  private async verifyRepost(
    threadId: string,
    username: string,
    headers: Record<string, string>
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_STARS_ARENA_API_URL}/post-reactions/reposts?threadId=${threadId}&repostPage=1&repostPerPage=50`,
        { headers }
      );

      if (!response.ok) {
        console.warn(`[VerifyRepost] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const candidates: any[] = Array.isArray(data.repostedUsers)
        ? data.repostedUsers
        : Array.isArray(data.items)
          ? data.items
          : [];

      const usernameLower = username.toLowerCase();

      for (const candidate of candidates) {
        const handles = this.collectHandles(candidate);
        if (handles.includes(usernameLower)) {
          return (
            candidate.id ||
            candidate.repostId ||
            candidate.threadId ||
            candidate.engagementId ||
            `repost_${Date.now()}`
          );
        }
      }

      return null;
    } catch (error) {
      console.error("[VerifyRepost] Error:", error);
      return null;
    }
  }

  private async verifyQuote(
    threadId: string,
    username: string,
    requiredContent: string,
    headers: Record<string, string>
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_STARS_ARENA_API_URL}/post-reactions/quotes?threadId=${threadId}&quotePage=1&quotePerPage=50`,
        { headers }
      );

      if (!response.ok) {
        console.warn(`[VerifyQuote] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const quotes: any[] = Array.isArray(data.quotes)
        ? data.quotes
        : Array.isArray(data.items)
          ? data.items
          : [];

      const usernameLower = username.toLowerCase();
      const requiredNormalized = this.normalizeContent(requiredContent);

      for (const quote of quotes) {
        const handles = this.collectHandles(quote);
        if (!handles.includes(usernameLower)) {
          continue;
        }

        const quoteContentNormalized = this.normalizeContent(
          quote.content || quote?.comment?.content
        );

        if (
          !requiredNormalized ||
          quoteContentNormalized.includes(requiredNormalized)
        ) {
          return (
            quote.id ||
            quote.threadId ||
            quote.repostId ||
            quote.engagementId ||
            `quote_${Date.now()}`
          );
        }
      }

      return null;
    } catch (error) {
      console.error("[VerifyQuote] Error:", error);
      return null;
    }
  }

  private async verifyComment(
    threadId: string,
    username: string,
    requiredContent: string,
    headers: Record<string, string>
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_STARS_ARENA_API_URL}/threads/${threadId}/comments`,
        { headers }
      );

      if (!response.ok) {
        console.warn(`[VerifyComment] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const rawComments: any[] = Array.isArray(data.comments)
        ? data.comments
        : Array.isArray(data.items)
          ? data.items
          : [];

      const usernameLower = username.toLowerCase();
      const requiredNormalized = this.normalizeContent(requiredContent);

      for (const entry of rawComments) {
        const comment = entry.comment ?? entry;
        const handles = this.collectHandles(comment);

        if (!handles.includes(usernameLower)) {
          continue;
        }

        const commentContentNormalized = this.normalizeContent(comment.content);

        if (
          requiredNormalized &&
          commentContentNormalized.includes(requiredNormalized)
        ) {
          return (
            comment.id ||
            comment.commentId ||
            comment.threadId ||
            comment.answerId ||
            `comment_${Date.now()}`
          );
        }
      }

      return null;
    } catch (error) {
      console.error("[VerifyComment] Error:", error);
      return null;
    }
  }

  private async verifyLike(
    threadId: string,
    username: string,
    headers: Record<string, string>,
    arenaUserId?: string
  ): Promise<boolean> {
    try {
      let page = 1;
      const perPage = 20;
      let hasMore = true;
      const usernameLower = username.toLowerCase();

      while (hasMore) {
        const response = await fetch(
          `${import.meta.env.VITE_STARS_ARENA_API_URL}/post-reactions/likes?threadId=${threadId}&likePage=${page}&likePerPage=${perPage}`,
          { headers }
        );

        if (!response.ok) {
          console.warn(`[VerifyLike] API error: ${response.status}`);
          return false;
        }

        const data = await response.json();
        const candidates: any[] = Array.isArray(data.likes)
          ? data.likes
          : Array.isArray(data.likedUsers)
            ? data.likedUsers
            : Array.isArray(data.items)
              ? data.items
              : Array.isArray(data.users)
                ? data.users
                : [];

        if (candidates.length === 0) {
          hasMore = false;
          break;
        }

        for (const candidate of candidates) {
          // Check by ID if available
          if (arenaUserId && candidate.id === arenaUserId) {
            return true;
          }

          // Fallback to handle check
          const handles = this.collectHandles(candidate);
          if (handles.includes(usernameLower)) {
            return true;
          }
        }

        if (candidates.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return false;
    } catch (error) {
      console.error("[VerifyLike] Error:", error);
      return false;
    }
  }

  async engageInPromotion(
    params: EngageParams,
    userAddress: string
  ): Promise<string> {
    try {
      const { payload } = await this.buildEngagementPayload(
        params,
        userAddress
      );

      const backendApiUrl = `${import.meta.env.VITE_BACKEND_API_URL || '/api/backend'}/engage/iframe`;

      const apiResponse = await fetch(backendApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify(payload),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();

        let errorResult: any;
        try {
          errorResult = JSON.parse(errorText);
        } catch {
          errorResult = { error: errorText };
        }

        const errorMessage =
          errorResult.error || errorResult.details || "Backend API error";
        throw new Error(errorMessage);
      }

      const result = await apiResponse.json();

      if (!result.success) {
        const errorMessage =
          result.error || "Backend returned unsuccessful response";
        throw new Error(errorMessage);
      }

      const txHash = result.data?.contractTxHash || "backend-processed";

      return txHash;
    } catch (error: any) {
      console.error("[engageInPromotion] Error:", error);
      throw new Error(error?.message || "Failed to engage in promotion");
    }
  }

  async claimReward(
    promotionId: number,
    provider: any,
    walletAddress: string,
    options?: { source?: "legacy" | "v2" }
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const isLegacy = options?.source === "legacy";
      const targetAddress = isLegacy
        ? LEGACY_POST2_EARN_CONTRACT_ADDRESS
        : POST2_EARN_CONTRACT_ADDRESS;
      const targetAbi = isLegacy
        ? LegacyPost2EarnABI.abi
        : Post2EarnABI.abi;

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        targetAddress,
        targetAbi,
        signer
      );

      const tx = await contract.claimReward(promotionId);

      return tx.hash;
    } catch (error: any) {
      console.error("[claimReward] Error:", error);
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes("session") || errorMsg.includes("provider") || errorMsg.includes("wallet")) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      throw new Error(error?.message || "Failed to claim reward");
    }
  }

  async claimAllRewards(
    provider: any,
    walletAddress: string,
    rewardTokenAddress: string = ARENA_TOKEN_ADDRESS
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const tokenAddress = rewardTokenAddress || ARENA_TOKEN_ADDRESS;
      if (!tokenAddress) {
        throw new Error("Reward token address is required to claim rewards.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      const tx = await contract.claimAllRewards(tokenAddress);

      return tx.hash;
    } catch (error: any) {
      console.error("[claimAllRewards] Error:", error);
      const errorMsg = error?.message?.toLowerCase() || "";
      if (
        errorMsg.includes("session") ||
        errorMsg.includes("provider") ||
        errorMsg.includes("wallet")
      ) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      throw new Error(error?.message || "Failed to claim rewards");
    }
  }

  async claimAllUnusedVault(
    provider: any,
    walletAddress: string,
    rewardTokenAddress: string = ARENA_TOKEN_ADDRESS
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const tokenAddress = rewardTokenAddress || ARENA_TOKEN_ADDRESS;
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error("Please provide a valid token address to withdraw the unused vault.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      const tx = await contract.claimAllUnusedVault(tokenAddress);

      return tx.hash;
    } catch (error: any) {
      console.error("[claimAllUnusedVault] Error:", error);
      const errorMsg = error?.message?.toLowerCase?.() || "";
      if (
        errorMsg.includes("session") ||
        errorMsg.includes("provider") ||
        errorMsg.includes("wallet")
      ) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      if (errorMsg.includes("user rejected")) {
        throw new Error("Transaction rejected. Unused vault not claimed.");
      }
      throw new Error(error?.message || "Failed to claim unused vault");
    }
  }

  async cancelPromotion(
    promotionId: number,
    provider: any,
    walletAddress: string
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      const tx = await contract.cancelPromotion(promotionId);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error: any) {
      console.error("[cancelPromotion] Error:", error);
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes("session") || errorMsg.includes("provider") || errorMsg.includes("wallet")) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      throw new Error(error?.message || "Failed to cancel promotion");
    }
  }

  async withdrawFromExpiredPromotion(
    promotionId: number,
    provider: any,
    walletAddress: string
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      const tx = await contract.withdrawFromExpiredPromotion(promotionId);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error: any) {
      console.error("[withdrawFromExpiredPromotion] Error:", error);
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes("session") || errorMsg.includes("provider") || errorMsg.includes("wallet")) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      throw new Error(
        error?.message || "Failed to withdraw from expired promotion"
      );
    }
  }

  async subscribeToken(
    tokenAddress: string,
    provider: any,
    walletAddress: string,
    options?: { months?: number; arenaUserId?: string }
  ): Promise<string> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
        throw new Error("Please enter a valid token address.");
      }

      const arenaUserId = options?.arenaUserId || "";
      if (!arenaUserId) {
        throw new Error("Arena user ID is required to subscribe token.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      const months = Math.max(1, Math.trunc(options?.months ?? 1));

      const fee: bigint = await contract.subscriptionFee();
      const totalFee = fee * BigInt(months);

      // New contract signature: subscribe(IERC20 _tokenToSubscribe, string calldata _arenaUserId, uint256 _months)
      const tx = await contract.subscribe(tokenAddress, arenaUserId, months, {
        value: totalFee,
      });
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error: any) {
      console.error("[subscribeToken] Error:", error);
      const errorMsg = error?.message?.toLowerCase?.() ?? "";
      if (errorMsg.includes("user rejected")) {
        throw new Error("Transaction rejected. Subscription not completed.");
      }
      if (errorMsg.includes("provider") || errorMsg.includes("wallet")) {
        throw new Error("WALLET_CONNECTION_FAILED");
      }
      throw new Error(error?.message || "Failed to subscribe token");
    }
  }



  async createPromotion(
    params: CreatePromotionParams,
    provider: any,
    walletAddress: string,
    onStatus?: (status: string, data?: any) => void
  ): Promise<CreatePromotionResult> {
    try {
      if (!provider || !walletAddress) {
        throw new Error("Arena provider or wallet address is missing.");
      }

      const {
        promotionType,
        slotsAvailable,
        vaultAmount,
        rewardPerSlot,
        minFollowers,
        expiresOn,
        postId,
        contentURI = "",
        content = "",
        tokenDecimals = 18,
        rewardTokenAddress,
        arenaUserId,
      } = params;

      if (!arenaUserId) {
        throw new Error("Arena user ID is required to create a promotion.");
      }

      const numericSlots = Number(slotsAvailable);
      if (!Number.isFinite(numericSlots) || numericSlots <= 0) {
        throw new Error("Slots available must be a positive number.");
      }

      const numericMinFollowers = Number(minFollowers);
      if (!Number.isFinite(numericMinFollowers) || numericMinFollowers < 0) {
        throw new Error("Minimum followers must be zero or a positive number.");
      }

      const numericExpiresOn = Number(expiresOn);
      if (
        !Number.isFinite(numericExpiresOn) ||
        numericExpiresOn <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error("Expiration must be set to a future time.");
      }

      if (!vaultAmount) {
        throw new Error("Vault amount is required.");
      }

      const normalizeAmount = (value: string) =>
        value.replace(/,/g, ".").trim();

      const fallbackDecimals = Number.isInteger(tokenDecimals)
        ? tokenDecimals
        : 18;
      const slots = BigInt(Math.trunc(numericSlots));
      const minFollowersValue = BigInt(Math.trunc(numericMinFollowers));
      const expiresOnValue = BigInt(Math.trunc(numericExpiresOn));

      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner(walletAddress);

      const contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        Post2EarnABI.abi,
        signer
      );

      // Use public provider for reads to avoid iframe/wallet delays
      const publicProvider = new ethers.JsonRpcProvider(PUBLIC_RPC);

      let resolvedRewardToken = rewardTokenAddress;
      if (!resolvedRewardToken) {
        try {
          // Try reading from public provider first for speed
          const publicContract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, publicProvider);
          resolvedRewardToken = await publicContract.platformToken();
        } catch (platformTokenError) {
          console.warn(
            "[createPromotion] Unable to read platform token from public RPC, trying signer",
            platformTokenError
          );
          try {
            resolvedRewardToken = await contract.platformToken();
          } catch (e) { console.warn("Fallback failed", e); }
        }
      }

      if (
        !resolvedRewardToken ||
        resolvedRewardToken === ethers.ZeroAddress
      ) {
        throw new Error("Reward token address is unavailable.");
      }

      const erc20Abi = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 value) returns (bool)",
        "function decimals() view returns (uint8)",
      ];

      const rewardToken = new ethers.Contract(
        resolvedRewardToken,
        erc20Abi,
        signer
      );

      // Read-only token contract
      const publicRewardToken = new ethers.Contract(
        resolvedRewardToken,
        erc20Abi,
        publicProvider
      );

      let decimalsForVault = fallbackDecimals;
      try {
        const chainDecimals = await publicRewardToken.decimals();
        if (typeof chainDecimals === "number") {
          decimalsForVault = chainDecimals;
        }
      } catch (decimalsError) {
        console.warn(
          "[createPromotion] Failed to fetch token decimals, using fallback",
          decimalsError
        );
      }

      const vaultValue = ethers.parseUnits(
        normalizeAmount(vaultAmount),
        decimalsForVault
      );
      let rewardValue: bigint;

      if (rewardPerSlot && rewardPerSlot.trim().length > 0) {
        rewardValue = ethers.parseUnits(
          normalizeAmount(rewardPerSlot),
          decimalsForVault
        );
      } else {
        if (slots === 0n) {
          throw new Error("Slots available must be greater than zero.");
        }
        rewardValue = vaultValue / slots;
        if (rewardValue <= 0n) {
          throw new Error(
            "Vault amount must be sufficient to reward each slot."
          );
        }
      }

      if (rewardValue * slots !== vaultValue) {
        throw new Error(
          "Vault amount must evenly divide across the available slots. Adjust the totals so vault ÷ slots is a whole reward amount."
        );
      }

      // Start polling for success immediately (Parallel execution)
      // This ensures that if the event appears at any point (even during approval wait), we catch it.
      let stopPolling = false;
      const pollForSuccess = async (): Promise<CreatePromotionResult | null> => {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const topic0 = "0x33c2bfd03f6df8791d3274129898f515527058219fc44aef43cf79b66ba8e4fd";
        const topic2 = ethers.zeroPadValue(walletAddress, 32);

        // Start looking from a few blocks back to catch recent events
        let startBlock: number | string = 'latest';
        try {
          const currentBlock = await publicProvider.getBlockNumber();
          startBlock = Math.max(0, currentBlock - 10);
        } catch (e) {
          console.warn("Could not get block number, defaulting to 'latest'", e);
        }

        const filter = {
          address: POST2_EARN_CONTRACT_ADDRESS,
          topics: [topic0, null, topic2],
          fromBlock: startBlock
        };

        // Poll for up to 3 minutes (covering approval + creation time)
        for (let i = 0; i < 90; i++) {
          if (stopPolling) return null;
          try {
            const logs = await publicProvider.getLogs(filter);
            for (const log of logs) {
              try {
                const parsed = contract.interface.parseLog(log);
                if (parsed?.name === "PromotionCreated") {
                  const rawPostId = parsed.args?.postId;
                  // Match postId to ensure it's THIS promotion
                  if (rawPostId === postId) {
                    return {
                      transactionHash: log.transactionHash,
                      promotionId: Number(parsed.args?.promotionId),
                    };
                  }
                }
              } catch (parseErr) { }
            }
          } catch (pollErr) {
            console.warn("Error polling logs", pollErr);
          }
          await sleep(2000);
        }
        return null;
      };

      // We wrap the main logic in a promise so we can race it against the poller
      const executeTransactionFlow = async (): Promise<CreatePromotionResult> => {
        onStatus?.('checking_allowance');
        // Use public provider for allowance check
        const currentAllowance: bigint = await publicRewardToken.allowance(
          walletAddress,
          POST2_EARN_CONTRACT_ADDRESS
        );

        let currentNonce = await browserProvider.getTransactionCount(walletAddress, 'pending');

        // Only request approval if insufficient allowance
        if (currentAllowance < vaultValue) {
          // Re-check allowance right before requesting signature
          // (it might have increased from external source while user was on review screen)
          const freshAllowance: bigint = await publicRewardToken.allowance(
            walletAddress,
            POST2_EARN_CONTRACT_ADDRESS
          );

          if (freshAllowance >= vaultValue) {
            // Allowance is now sufficient, skip approval
            onStatus?.('checking_allowance'); // Reset to checking state
          } else {
            onStatus?.('awaiting_approval_signature');
            try {
              // Submit approval with explicit nonce
              const approveTx = await rewardToken.approve(POST2_EARN_CONTRACT_ADDRESS, vaultValue, {
                nonce: currentNonce
              });

              onStatus?.('approval_submitted', { hash: approveTx.hash });

              // Increment nonce for the next transaction
              currentNonce++;

              // Poll for allowance increase (don't rely on tx receipt)
              const pollAllowanceIncrease = async () => {
                const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
                const targetAllowance = freshAllowance + vaultValue;

                // Poll every 1s for up to 60s
                for (let i = 0; i < 60; i++) {
                  await sleep(1000);
                  try {
                    const newestAllowance: bigint = await publicRewardToken.allowance(
                      walletAddress,
                      POST2_EARN_CONTRACT_ADDRESS
                    );
                    if (newestAllowance >= targetAllowance) {
                      onStatus?.('approval_confirmed', { hash: approveTx.hash });
                      return;
                    }
                  } catch (e) {
                    console.warn('Error polling allowance:', e);
                  }
                }
              };

              // Start polling but don't wait - proceed immediately to creation
              void pollAllowanceIncrease();

              // Small delay to ensure wallet is ready for next transaction
              await new Promise(r => setTimeout(r, 500));

            } catch (approveError: any) {
              console.warn('[createPromotion] approve() error:', approveError?.message || approveError);
              // Re-throw if it's a user rejection
              if (approveError?.message?.toLowerCase?.().includes("user rejected") ||
                approveError?.message?.toLowerCase?.().includes("user denied")) {
                throw new Error("Transaction rejected. Approval not completed.");
              }
              // Otherwise continue - maybe allowance was already sufficient
            }
          }
        }

        onStatus?.('awaiting_submit_signature');

        // Send createPromotion transaction immediately with the next nonce
        const tx = await contract.createPromotion(
          resolvedRewardToken,
          promotionType,
          slots,
          vaultValue,
          minFollowersValue,
          expiresOnValue,
          postId,
          contentURI,
          content,
          arenaUserId,
          { nonce: currentNonce }
        );

        onStatus?.('submit_submitted', { hash: tx.hash });

        // Don't wait for tx.wait() - let the event poller handle success detection
        onStatus?.('verifying_explorer');

        // Return a never-resolving promise - let the poller win the race
        return new Promise(() => { }); // Wait forever, let the poller win
      };

      // Race the transaction flow against the success poller
      // If the poller finds the event (e.g. from a previous attempt or the current one), it wins.
      // If the transaction flow throws an error (e.g. user rejects), we should propagate that.

      return await Promise.race([
        pollForSuccess().then(res => {
          if (res) return res;
          throw new Error("Polling timed out without finding promotion.");
        }),
        executeTransactionFlow()
      ]).finally(() => {
        stopPolling = true;
      });

    } catch (error: any) {
      console.error("[createPromotion] Error:", error);
      const message = error?.message ?? "";
      const data = error?.data ?? "";

      if (
        typeof message === "string" &&
        message.toLowerCase().includes("user rejected")
      ) {
        throw new Error("Transaction rejected. Promotion was not created.");
      }

      if (
        (typeof message === "string" &&
          message.includes("ERC20InsufficientBalance")) ||
        (typeof data === "string" && data.startsWith("0xe450d38c"))
      ) {
        throw new Error(
          "Insufficient ARENA balance to cover the vault deposit."
        );
      }

      if (
        (typeof message === "string" &&
          message.includes("ERC20InsufficientAllowance")) ||
        (typeof data === "string" && data.startsWith("0xfb8f41b2"))
      ) {
        throw new Error(
          "Spending allowance too low. Please retry so we can refresh the approval and submit again."
        );
      }

      throw new Error(message || "Failed to create promotion");
    }
  }
}

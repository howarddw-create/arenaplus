import { ethers } from "ethers";
import Post2EarnABI from "../../contract/Post2EarnABI.json";
import LegacyPost2EarnABI from "../../contract/legacyPost2EarnABI.json";
import Post2EarnCA from "../../contract/Post2EarnCA.json";
import type {
  Promotion,
  PromotionsFilterOptions,
  Engagement,
  UnclaimedReward,
  PromoterPromotionFilter,
  SubscribedRewardToken,
  RewardTokenMetadata,
} from "./types";

const PUBLIC_RPC = import.meta.env.VITE_AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

const {
  POST2_EARN_CONTRACT_ADDRESS,
  LEGACY_POST2_EARN_CONTRACT_ADDRESS,
} = Post2EarnCA;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ERC20_METADATA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const PROMOTER_FILTER_VALUES: Record<PromoterPromotionFilter, number> = {
  all: 0,
  cancelAvailable: 1,
  expiredWithUnusedVault: 2,
  vaultClaimed: 3,
};

export class Post2EarnGetters {
  private readonly HARDCODED_AUTH_TOKEN = import.meta.env.VITE_APP_AUTH_TOKEN;
  private provider = new ethers.JsonRpcProvider(PUBLIC_RPC);

  private normalizePromotion(id: number, data: any) {
    return {
      id,
      promoter: data.promoter,
      promotionType: Number(data.promotionType),
      slotsAvailable: Number(data.slotsAvailable ?? 0),
      slotsTaken: Number(data.slotsTaken ?? 0),
      vaultAmount: data.vaultAmount?.toString?.() ?? "0",
      rewardPerSlot: data.rewardPerSlot?.toString?.() ?? "0",
      minFollowers: Number(data.minFollowers ?? 0),
      expiresOn: Number(data.expiresOn ?? 0),
      postId: data.postId ?? "",
      contentURI: data.contentURI ?? "",
      contentHash: data.contentHash ?? "",
      content: data.content ?? "",
      active: Boolean(data.active),
      postData: data.postData,
      rewardToken: data.rewardToken ?? data.rewardTokenAddress ?? undefined,
      arenaUserId: typeof data.arenaUserId === "string" ? data.arenaUserId : undefined,
    } as Promotion;
  }

  async getBearerToken(): Promise<string> {
    return this.HARDCODED_AUTH_TOKEN;
  }

  private async readErc20StringData(
    tokenAddress: string,
    functionName: "name" | "symbol"
  ): Promise<string | null> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, this.provider);
      const value = await contract[functionName]();
      return value;
    } catch (error) {
      console.warn(
        `[Post2Earn] Failed to read ${functionName} for token ${tokenAddress}`,
        error
      );
      return null;
    }
  }

  private async readErc20Decimals(tokenAddress: string): Promise<number | null> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, this.provider);
      const value = await contract.decimals();
      return Number(value);
    } catch (error) {
      console.warn(
        `[Post2Earn] Failed to read decimals for token ${tokenAddress}`,
        error
      );
      return null;
    }
  }

  async getTokenUnusedVault(
    tokenAddress: string,
    promoterAddress: string
  ): Promise<string> {
    if (!tokenAddress) {
      throw new Error("Token address is required");
    }
    if (!promoterAddress) {
      throw new Error("Promoter address is required");
    }

    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const rawAmount = await contract.getTokenUnusedVault(tokenAddress, promoterAddress);

      return rawAmount.toString();
    } catch (error: any) {
      console.error("[Post2Earn] Failed to fetch token unused vault:", error);
      throw new Error(error?.message || "Unable to load token unused vault");
    }
  }

  async getSubscriptionFee(): Promise<string> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const fee = await contract.subscriptionFee();

      return fee.toString();
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch subscription fee");
    }
  }

  async getActiveSubscribedTokens(): Promise<SubscribedRewardToken[]> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const result = await contract.getActiveSubscriptions();

      const [tokens, expirations, subscribers] = result;
      const now = Math.floor(Date.now() / 1000);
      const uniqueTokens = new Map<string, SubscribedRewardToken>();

      for (let i = 0; i < tokens.length; i++) {
        const tokenAddress = tokens[i];
        if (!tokenAddress || tokenAddress === ZERO_ADDRESS) continue;

        const ttlSeconds = Number(expirations[i] ?? 0n);
        if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) continue;

        const expiresAt = now + ttlSeconds;

        const normalized = tokenAddress.toLowerCase();
        const entry: SubscribedRewardToken = {
          tokenAddress,
          subscriber: subscribers[i],
          expiresAt,
        };

        const existing = uniqueTokens.get(normalized);
        if (!existing || expiresAt > existing.expiresAt) {
          uniqueTokens.set(normalized, entry);
        }
      }

      const finalTokens = Array.from(uniqueTokens.values());
      await Promise.all(
        finalTokens.map(async (token) => {
          const [symbol, name, decimals] = await Promise.all([
            this.readErc20StringData(token.tokenAddress, "symbol"),
            this.readErc20StringData(token.tokenAddress, "name"),
            this.readErc20Decimals(token.tokenAddress),
          ]);
          if (symbol) token.symbol = symbol;
          if (name) token.name = name;
          if (decimals !== null) token.decimals = decimals;
        })
      );

      return finalTokens.sort((a, b) => {
        const aLabel = (a.symbol || a.tokenAddress).toLowerCase();
        const bLabel = (b.symbol || b.tokenAddress).toLowerCase();
        return aLabel.localeCompare(bLabel);
      });
    } catch (error) {
      console.error(
        "[Post2Earn] Failed to fetch active subscribed tokens:",
        error
      );
      return [];
    }
  }

  async getRewardTokenMetadata(
    tokenAddress: string
  ): Promise<RewardTokenMetadata | null> {
    if (!tokenAddress || tokenAddress === ZERO_ADDRESS) {
      return null;
    }

    try {
      const [symbol, name, decimals] = await Promise.all([
        this.readErc20StringData(tokenAddress, "symbol"),
        this.readErc20StringData(tokenAddress, "name"),
        this.readErc20Decimals(tokenAddress),
      ]);

      return {
        tokenAddress,
        symbol: symbol ?? undefined,
        name: name ?? undefined,
        decimals: typeof decimals === "number" ? decimals : undefined,
      };
    } catch (error) {
      console.error(
        "[Post2Earn] Failed to fetch reward token metadata:",
        error
      );
      return null;
    }
  }

  async fetchPostContent(postId: string): Promise<any> {
    try {
      const authToken = await this.getBearerToken();
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = authToken.startsWith("Bearer ")
          ? authToken
          : `Bearer ${authToken}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_STARS_ARENA_API_URL}/threads/nested?threadId=${postId}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Post2Earn] HTTP Error Response:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      const threadData =
        data.threads && data.threads.length > 0 ? data.threads[0] : null;

      return threadData;
    } catch (error) {
      console.error("[Post2Earn] Failed to fetch post content:", error);
      return null;
    }
  }

  private decodeBase64(base64: string): string {
    const globalRef =
      typeof globalThis !== "undefined" ? (globalThis as any) : {};

    if (typeof globalRef.atob === "function") {
      return globalRef.atob(base64);
    }

    if (globalRef.Buffer) {
      return globalRef.Buffer.from(base64, "base64").toString("utf-8");
    }

    throw new Error("Base64 decoding is not supported in this environment");
  }

  private async fetchTextFromContentUri(uri: string): Promise<string> {
    if (!uri) {
      throw new Error("Content URI is required");
    }

    if (uri.startsWith("data:")) {
      const base64 = uri.split(",")[1] || "";
      return this.decodeBase64(base64);
    }

    let targetUrl = uri;

    if (uri.startsWith("lens://")) {
      const key = uri.replace("lens://", "");
      targetUrl = `${import.meta.env.VITE_GROVE_API_URL}/${key}`;
    }

    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  }

  async fetchPromotionContent(
    promotionOrId: Promotion | number
  ): Promise<string | null> {
    try {
      const promotionDetails =
        typeof promotionOrId === "number"
          ? await this.getPromotionDetails(promotionOrId)
          : promotionOrId;

      if (!promotionDetails) {
        return null;
      }

      if (promotionDetails.contentURI) {
        try {
          const text = await this.fetchTextFromContentUri(
            promotionDetails.contentURI
          );
          if (text) {
            return text;
          }
        } catch (innerError) {
          console.error(
            "[Post2Earn] Failed to fetch content from URI:",
            innerError
          );
        }
      }

      return promotionDetails.content || null;
    } catch (error) {
      console.error("[Post2Earn] Failed to fetch promotion content:", error);
      return null;
    }
  }

  async fetchAllPromotions(): Promise<Promotion[]> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const promotionCount = await contract.promotionCount();

      const promotions = [];
      for (let i = 0; i < Number(promotionCount); i++) {
        const promotionData = await contract.getPromotionDetails(i);
        promotions.push(this.normalizePromotion(i, promotionData));
      }
      return promotions;
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch promotions");
    }
  }

  async fetchPromotionsFiltered(
    options: PromotionsFilterOptions
  ): Promise<Promotion[]> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      let promotionIds: bigint[] = [];

      // Handle "engagers" sort key by ignoring it for now or mapping to something else if unsupported on contract
      // Assuming similar logic to fetchAllPromotions but with specific contract methods if they exist

      switch (options.sortKey) {
        case "latest":
          // @ts-ignore
          promotionIds = await contract.getActivePromotionsByLatest(options.offset, options.limit);
          break;
        case "oldest":
          // @ts-ignore
          promotionIds = await contract.getActivePromotionsByOldest(options.offset, options.limit);
          break;
        case "vault":
          // Mapping vault sort to latest for simplicity if specific method missing, or use getActivePromotionsByVaultAmount if available
          // @ts-ignore
          promotionIds = await contract.getActivePromotionsByLatest(options.offset, options.limit);
          break;
        default:
          // @ts-ignore
          promotionIds = await contract.getActivePromotionsByLatest(options.offset, options.limit);
      }

      const promotions = [];
      for (const id of promotionIds) {
        const promotionData = await contract.getPromotionDetails(id);
        promotions.push(this.normalizePromotion(Number(id), promotionData));
      }
      return promotions;
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch filtered promotions");
    }
  }

  async getActivePromotions(
    offset: number = 0,
    limit: number = 10
  ): Promise<Promotion[]> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      // @ts-ignore
      const promotionIds = await contract.getActivePromotionsByLatest(offset, limit);

      const promotions = [];
      for (const id of promotionIds) {
        const promotionData = await contract.getPromotionDetails(id);
        promotions.push(this.normalizePromotion(Number(id), promotionData));
      }

      return promotions;
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch active promotions");
    }
  }

  async getPromotionDetails(promotionId: number): Promise<Promotion> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const promotionData = await contract.getPromotionDetails(promotionId);
      return this.normalizePromotion(promotionId, promotionData);
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch promotion details");
    }
  }

  async getUnclaimedRewards(userAddress?: string): Promise<UnclaimedReward[]> {
    try {
      if (!userAddress) {
        throw new Error("User address is required");
      }

      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      // @ts-ignore
      const promotionIds: bigint[] = await contract.getUnclaimedRewards(userAddress);

      let legacyPromotionIds: bigint[] = [];
      try {
        const legacyContract = new ethers.Contract(LEGACY_POST2_EARN_CONTRACT_ADDRESS, LegacyPost2EarnABI.abi, this.provider);
        // @ts-ignore
        legacyPromotionIds = await legacyContract.getUnclaimedRewards(userAddress);
      } catch (legacyError) {
        console.warn(
          "[Post2Earn] Failed to fetch legacy unclaimed rewards:",
          legacyError
        );
      }

      const rewards: UnclaimedReward[] = [];

      for (const id of promotionIds) {
        const promotion = await contract.getPromotionDetails(id);
        rewards.push({
          promotionId: Number(id),
          promotion: this.normalizePromotion(Number(id), promotion),
          rewardAmount: promotion.rewardPerSlot?.toString?.() ?? "0",
          source: "v2",
          contractAddress: POST2_EARN_CONTRACT_ADDRESS,
        });
      }

      for (const id of legacyPromotionIds) {
        const legacyContract = new ethers.Contract(LEGACY_POST2_EARN_CONTRACT_ADDRESS, LegacyPost2EarnABI.abi, this.provider);
        const promotion = await legacyContract.getPromotionDetails(id);

        rewards.push({
          promotionId: Number(id),
          promotion: this.normalizePromotion(Number(id), promotion),
          rewardAmount: promotion.rewardPerSlot?.toString?.() ?? "0",
          source: "legacy",
          contractAddress: LEGACY_POST2_EARN_CONTRACT_ADDRESS,
        });
      }

      return rewards;
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch unclaimed rewards");
    }
  }

  async getMyPromotions(
    userAddress?: string,
    options?: {
      offset?: number;
      limit?: number;
      newestFirst?: boolean;
      filter?: PromoterPromotionFilter;
    }
  ): Promise<Promotion[]> {
    try {
      if (!userAddress) {
        throw new Error("User address is required");
      }

      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? 50;
      const newestFirst = options?.newestFirst ?? true;
      const filterKey = options?.filter ?? "all";
      const filterValue = PROMOTER_FILTER_VALUES[filterKey] ?? 0;

      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      // @ts-ignore
      const promotionIds = await contract.getPromoterCreatedPromotions(
        userAddress,
        BigInt(offset),
        BigInt(limit),
        newestFirst,
        filterValue
      );

      const promotions = [];
      for (const id of promotionIds) {
        const promotionData = await contract.getPromotionDetails(id);
        promotions.push(this.normalizePromotion(Number(id), promotionData));
      }
      return promotions;
    } catch (error: any) {
      throw new Error(error?.message || "Failed to fetch my promotions");
    }
  }

  async getPromotionEngagements(promotionId: number): Promise<Engagement[]> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      // @ts-ignore
      const engagements = await contract.getPromotionEngagementData(promotionId);

      return engagements.map((engagement: any) => ({
        engager: engagement.engager,
        twitterUsername: engagement.twitterUsername,
        engagementPostId: engagement.engagementPostId,
        followerCount: Number(engagement.followerCount),
        rewarded: engagement.rewarded,
        arenaUserId: engagement.arenaUserId,
      }));
    } catch (error: any) {
      throw new Error(
        error?.message || "Failed to fetch promotion engagements"
      );
    }
  }

  async checkUserEngagement(
    promotionId: number,
    userAddress: string
  ): Promise<string | null> {
    if (!userAddress) {
      return null;
    }

    const normalizedAddress = userAddress.toLowerCase();

    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const engagement = await contract.engagementsData(promotionId, userAddress);

      const engagerAddress =
        typeof engagement?.engager === "string"
          ? engagement.engager
          : undefined;
      if (
        engagerAddress &&
        engagerAddress !== ZERO_ADDRESS &&
        engagerAddress.toLowerCase() === normalizedAddress
      ) {
        const engagementPostId =
          engagement?.engagementPostId && engagement.engagementPostId !== ""
            ? engagement.engagementPostId
            : "engaged";
        return engagementPostId;
      }
    } catch (directLookupError) {
      console.warn(
        "[Post2Earn] Direct engagement lookup failed, falling back to scanning list:",
        directLookupError
      );
    }

    try {
      const engagements = await this.getPromotionEngagements(promotionId);
      const userEngagement = engagements.find(
        (e) => e.engager.toLowerCase() === normalizedAddress
      );
      return userEngagement
        ? userEngagement.engagementPostId || "engaged"
        : null;
    } catch (error: any) {
      console.error("Failed to check user engagement:", error);
      return null;
    }
  }

  async isPromotionAvailable(postId: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(POST2_EARN_CONTRACT_ADDRESS, Post2EarnABI.abi, this.provider);
      const isAvailable = await contract.isPromotionAvailable(postId);

      return isAvailable;
    } catch (error: any) {
      throw new Error(
        error?.message || "Failed to check promotion availability"
      );
    }
  }

  async getTokenAllowance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, this.provider);
      const [allowance, decimals] = await Promise.all([
        contract.allowance(walletAddress, POST2_EARN_CONTRACT_ADDRESS),
        contract.decimals(),
      ]);

      // Format the allowance for display
      const allowanceStr = allowance.toString();
      const decimalsNum = Number(decimals);

      // Convert to human-readable format
      if (allowanceStr === "0") {
        return "0";
      }

      const divisor = BigInt(10 ** decimalsNum);
      const wholePart = allowance / divisor;
      const remainder = allowance % divisor;

      if (remainder === 0n) {
        return wholePart.toString();
      }

      // Show up to 2 decimal places
      const fractionalStr = remainder.toString().padStart(decimalsNum, "0");
      const significantFractional = fractionalStr.slice(0, 2);

      return `${wholePart}.${significantFractional}`;
    } catch (error: any) {
      console.error("[Post2Earn] Failed to fetch token allowance:", error);
      throw new Error(error?.message || "Failed to fetch token allowance");
    }
  }
}

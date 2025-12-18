export type ContractSource = "v2" | "legacy";

export interface EngageParams {
    promotionId: number;
    engagementPostId: string;
    promotionPostId: string;
    engagementType: string;
    content?: string;
    followerCount?: number;
    twitterUsername?: string;
    arenaUserId?: string;
}

export interface EngageParamsOld {
    promotionId: number;
    twitterUsername: string;
    engagementPostId: string;
    followerCount: number;
    content: string;
    signature: string;
}

export type PromotionsSortKey = "latest" | "oldest" | "vault" | "engagers";

export type PromoterPromotionFilter =
    | "all"
    | "cancelAvailable"
    | "expiredWithUnusedVault"
    | "vaultClaimed";

export interface PromotionsFilterOptions {
    sortKey: PromotionsSortKey;
    newestFirst?: boolean;
    offset: number;
    limit: number;
    minVaultPlus?: string;
    maxVaultPlus?: string;
    minEngagers?: number;
    maxEngagers?: number;
}

export interface Promotion {
    id: number;
    promoter: string;
    promotionType: number;
    slotsAvailable: number;
    slotsTaken: number;
    vaultAmount: string;
    rewardPerSlot: string;
    minFollowers: number;
    expiresOn: number;
    postId: string;
    contentURI: string;
    contentHash: string;
    content: string;
    active: boolean;
    postData?: any;
    rewardToken?: string;
    arenaUserId?: string;
    likesMandatory?: boolean;
}

export interface Engagement {
    engager: string;
    twitterUsername: string;
    engagementPostId: string;
    followerCount: number;
    rewarded: boolean;
    arenaUserId?: string;
}

export interface UnclaimedReward {
    promotionId: number;
    promotion: Promotion;
    rewardAmount: string;
    source: ContractSource;
    contractAddress: string;
}

export interface CreatePromotionParams {
    promotionType: number;
    slotsAvailable: number;
    vaultAmount: string;
    rewardPerSlot?: string;
    minFollowers: number;
    expiresOn: number;
    postId: string;
    contentURI?: string;
    content?: string;
    tokenDecimals?: number;
    rewardTokenAddress?: string;
    arenaUserId: string;
}

export interface CreatePromotionResult {
    transactionHash: string;
    promotionId: number | null;
}

export interface RewardTokenMetadata {
    tokenAddress: string;
    symbol?: string;
    name?: string;
    decimals?: number;
}

export interface SubscribedRewardToken extends RewardTokenMetadata {
    subscriber: string;
    expiresAt: number;
}

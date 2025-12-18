import { Post2EarnGetters } from './getters';
import { Post2EarnActions } from './actions';
import { Post2EarnUtils } from './utils';
import type {
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
} from './types';

class Post2EarnService {
    private getters = new Post2EarnGetters();
    private actions = new Post2EarnActions();

    // Getter methods
    async getBearerToken(): Promise<string> {
        return this.getters.getBearerToken();
    }

    async fetchPostContent(postId: string): Promise<any> {
        return this.getters.fetchPostContent(postId);
    }

    async fetchPromotionContent(promotionOrId: Promotion | number): Promise<string | null> {
        return this.getters.fetchPromotionContent(promotionOrId);
    }

    async getSubscriptionFee(): Promise<string> {
        return this.getters.getSubscriptionFee();
    }

    async fetchAllPromotions(): Promise<Promotion[]> {
        return this.getters.fetchAllPromotions();
    }

    async fetchPromotionsFiltered(options: PromotionsFilterOptions): Promise<Promotion[]> {
        return this.getters.fetchPromotionsFiltered(options);
    }

    async getActivePromotions(offset: number = 0, limit: number = 10): Promise<Promotion[]> {
        return this.getters.getActivePromotions(offset, limit);
    }

    async getPromotionDetails(promotionId: number): Promise<Promotion> {
        return this.getters.getPromotionDetails(promotionId);
    }

    async getUnclaimedRewards(userAddress?: string): Promise<UnclaimedReward[]> {
        return this.getters.getUnclaimedRewards(userAddress);
    }

    async getActiveSubscribedTokens(): Promise<SubscribedRewardToken[]> {
        return this.getters.getActiveSubscribedTokens();
    }

    async getRewardTokenMetadata(tokenAddress: string): Promise<RewardTokenMetadata | null> {
        return this.getters.getRewardTokenMetadata(tokenAddress);
    }

    async getMyPromotions(
        userAddress?: string,
        options?: { offset?: number; limit?: number; newestFirst?: boolean; filter?: PromoterPromotionFilter }
    ): Promise<Promotion[]> {
        return this.getters.getMyPromotions(userAddress, options);
    }

    async getPromotionEngagements(promotionId: number): Promise<Engagement[]> {
        return this.getters.getPromotionEngagements(promotionId);
    }

    async checkUserEngagement(promotionId: number, userAddress: string): Promise<string | null> {
        return this.getters.checkUserEngagement(promotionId, userAddress);
    }

    async isPromotionAvailable(postId: string): Promise<boolean> {
        return this.getters.isPromotionAvailable(postId);
    }

    async getTokenAllowance(tokenAddress: string, walletAddress: string): Promise<string> {
        return this.getters.getTokenAllowance(tokenAddress, walletAddress);
    }

    async getTokenUnusedVault(tokenAddress: string, promoterAddress: string): Promise<string> {
        return this.getters.getTokenUnusedVault(tokenAddress, promoterAddress);
    }

    // Action methods

    async repostThread(threadId: string): Promise<any> {
        return this.actions.repostThread(threadId);
    }

    async verifyEngagement(params: EngageParams, userAddress: string): Promise<{ success: boolean; message?: string; engagementId?: string }> {
        return this.actions.verifyEngagement(params, userAddress);
    }

    async engageInPromotion(params: EngageParams, walletAddress: string): Promise<string> {
        return this.actions.engageInPromotion(params, walletAddress);
    }

    async claimReward(promotionId: number, provider: any, walletAddress: string, options?: { source?: "legacy" | "v2" }): Promise<string> {
        return this.actions.claimReward(promotionId, provider, walletAddress, options);
    }

    async claimAllRewards(provider: any, walletAddress: string, rewardTokenAddress?: string): Promise<string> {
        return this.actions.claimAllRewards(provider, walletAddress, rewardTokenAddress);
    }

    async claimAllUnusedVault(provider: any, walletAddress: string, rewardTokenAddress?: string): Promise<string> {
        return this.actions.claimAllUnusedVault(provider, walletAddress, rewardTokenAddress);
    }

    async cancelPromotion(promotionId: number, provider: any, walletAddress: string): Promise<string> {
        return this.actions.cancelPromotion(promotionId, provider, walletAddress);
    }

    async withdrawFromExpiredPromotion(promotionId: number, provider: any, walletAddress: string): Promise<string> {
        return this.actions.withdrawFromExpiredPromotion(promotionId, provider, walletAddress);
    }

    async createPromotion(
        params: CreatePromotionParams,
        provider: any,
        walletAddress: string,
        onStatus?: (status: string, data?: any) => void
    ): Promise<CreatePromotionResult> {
        return this.actions.createPromotion(params, provider, walletAddress, onStatus);
    }

    async subscribeToken(
        tokenAddress: string,
        provider: any,
        walletAddress: string,
        options?: { months?: number; arenaUserId?: string }
    ): Promise<string> {
        return this.actions.subscribeToken(tokenAddress, provider, walletAddress, options);
    }

    // Utility methods
    formatTokenAmount(amount: string, decimals: number = 18): string {
        return Post2EarnUtils.formatTokenAmount(amount, decimals);
    }

    getPromotionTypeLabel(type: number): string {
        return Post2EarnUtils.getPromotionTypeLabel(type);
    }

    isPromotionExpired(expiresOn: number): boolean {
        return Post2EarnUtils.isPromotionExpired(expiresOn);
    }

    getTimeRemaining(expiresOn: number): string {
        return Post2EarnUtils.getTimeRemaining(expiresOn);
    }

    parseRichTextContent(htmlContent: string, maxWords: number = 15): { content: string; isHTML: boolean } {
        return Post2EarnUtils.parseRichTextContent(htmlContent, maxWords);
    }

    async fetchTextViaBackground(url: string): Promise<string> {
        return Post2EarnUtils.fetchTextViaBackground(url);
    }

    async fetchTextFromUrl(url: string): Promise<string> {
        return Post2EarnUtils.fetchTextFromUrl(url);
    }
}

const post2EarnService = new Post2EarnService();
export default post2EarnService;

// Export types for external use
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
};

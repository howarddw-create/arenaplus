/**
 * Service for interacting with the Arena Community API
 * Fetches community metadata including token images
 */

export interface CommunityData {
    id: string;
    name: string;
    ticker: string;
    tokenName: string;
    photoURL: string | null;
    bannerURL: string | null;
    description: string | null;
    followerCount: number;
    contractAddress: string;
    pairAddress: string;
}

export interface CommunitySearchResponse {
    communities: CommunityData[];
}

/**
 * Get the auth token from arena.social cookies via background script
 */
async function getAuthToken(): Promise<string | null> {
    try {
        const response: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_BEARER_TOKEN' }, resolve);
        });

        if (response?.token) {
            return response.token;
        }

        if (response?.error) {
            console.warn('[CommunityService] Auth token error:', response.error);
        }

        return null;
    } catch (error) {
        console.warn('[CommunityService] Failed to get auth token:', error);
        return null;
    }
}

/**
 * Search for communities by ticker or name
 * @param searchString - The ticker or name to search for
 * @returns Community data if found, null otherwise
 */
export async function searchCommunityByTicker(
    searchString: string
): Promise<CommunityData | null> {
    const authToken = await getAuthToken();

    if (!authToken) {
        console.warn('[CommunityService] Missing auth token');
        return null;
    }

    if (!searchString || searchString.trim().length === 0) {
        console.warn('[CommunityService] Empty search string');
        return null;
    }

    try {
        const baseUrl = import.meta.env.VITE_ARENA_SOCIAL_API_URL || 'https://api.arena.social';
        const url = `${baseUrl}/communities/search?searchString=${encodeURIComponent(searchString.trim())}`;

        const response = await fetch(url, {
            headers: {
                Authorization: authToken, // Token already includes 'Bearer ' prefix
            },
        });

        if (!response.ok) {
            console.warn(`[CommunityService] Search failed with status ${response.status}`);
            return null;
        }

        const data: CommunitySearchResponse = await response.json();

        // Return the first matching community
        // Prioritize exact ticker match if available
        if (data.communities && data.communities.length > 0) {
            const exactMatch = data.communities.find(
                (c) => c.ticker.toLowerCase() === searchString.toLowerCase()
            );
            return exactMatch || data.communities[0];
        }

        return null;
    } catch (error) {
        console.error('[CommunityService] Failed to search community:', error);
        return null;
    }
}

/**
 * Batch fetch communities by multiple tickers
 * @param tickers - Array of tickers to fetch
 * @returns Map of ticker to community data
 */
export async function batchFetchCommunities(
    tickers: string[]
): Promise<Map<string, CommunityData | null>> {
    const results = new Map<string, CommunityData | null>();

    // Fetch all communities in parallel
    await Promise.all(
        tickers.map(async (ticker) => {
            const data = await searchCommunityByTicker(ticker);
            results.set(ticker.toLowerCase(), data);
        })
    );

    return results;
}

const communityService = {
    searchCommunityByTicker,
    batchFetchCommunities,
};

export default communityService;

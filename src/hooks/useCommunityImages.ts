import { useState, useEffect, useCallback } from 'react';
import communityService, { CommunityData } from '../services/communityService';

export interface CommunityMetadata {
    photoURL: string | null;
    name: string;
    ticker: string;
    loading: boolean;
    error: string | null;
}

/**
 * Custom hook to fetch and cache community images by ticker
 * @param tickers - Array of token tickers to fetch images for
 * @returns Map of ticker (lowercase) to community metadata
 */
export function useCommunityImages(tickers: string[]) {
    const [communities, setCommunities] = useState<Record<string, CommunityMetadata>>({});
    const [loading, setLoading] = useState(false);

    const fetchCommunities = useCallback(async (tickersToFetch: string[]) => {
        if (tickersToFetch.length === 0) return;

        // Mark tickers as loading
        setCommunities(prev => {
            const updated = { ...prev };
            tickersToFetch.forEach(ticker => {
                const key = ticker.toLowerCase();
                if (!updated[key]) {
                    updated[key] = {
                        photoURL: null,
                        name: '',
                        ticker,
                        loading: true,
                        error: null,
                    };
                }
            });
            return updated;
        });

        setLoading(true);

        try {
            const results = await communityService.batchFetchCommunities(tickersToFetch);

            setCommunities(prev => {
                const updated = { ...prev };
                results.forEach((data: CommunityData | null, ticker: string) => {
                    const key = ticker.toLowerCase();
                    if (data) {
                        updated[key] = {
                            photoURL: data.photoURL,
                            name: data.name,
                            ticker: data.ticker,
                            loading: false,
                            error: null,
                        };
                    } else {
                        updated[key] = {
                            photoURL: null,
                            name: ticker.toUpperCase(),
                            ticker: ticker.toUpperCase(),
                            loading: false,
                            error: null,
                        };
                    }
                });
                return updated;
            });
        } catch (error) {
            console.error('[useCommunityImages] Failed to fetch communities:', error);
            // Mark all as failed
            setCommunities(prev => {
                const updated = { ...prev };
                tickersToFetch.forEach(ticker => {
                    const key = ticker.toLowerCase();
                    updated[key] = {
                        photoURL: null,
                        name: ticker.toUpperCase(),
                        ticker: ticker.toUpperCase(),
                        loading: false,
                        error: error instanceof Error ? error.message : 'Failed to fetch',
                    };
                });
                return updated;
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Filter out tickers that are already cached
        const tickersToFetch = tickers.filter(ticker => {
            const key = ticker.toLowerCase();
            return !communities[key];
        });

        if (tickersToFetch.length > 0) {
            void fetchCommunities(tickersToFetch);
        }
    }, [tickers, communities, fetchCommunities]);

    return {
        communities,
        loading,
        refetch: fetchCommunities,
    };
}

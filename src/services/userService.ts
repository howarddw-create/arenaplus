interface FreshUserData {
  followerCount: number;
  userId?: string;
}

interface UserApiResponse {
  user: {
    id: string;
    twitterHandle: string;
    twitterName: string;
    twitterPicture: string;
    followerCount: number;
    threadCount: number;
    followingsCount: number;
    twitterFollowers: number;
    handle: string;
  };
}

interface CacheEntry {
  data: FreshUserData | null;
  timestamp: number;
}

class UserService {
  private readonly BASE_URL = import.meta.env.VITE_STARS_ARENA_API_URL || 'https://api.starsarena.com';
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<FreshUserData | null>> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async fetchFreshFollowerCount(handle: string): Promise<FreshUserData | null> {
    try {
      const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

      // Check cache first
      const cached = this.cache.get(cleanHandle);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`[UserService] Using cached data for ${cleanHandle}`);
        return cached.data;
      }

      // Check if there's already a pending request for this handle
      const pending = this.pendingRequests.get(cleanHandle);
      if (pending) {
        console.log(`[UserService] Reusing pending request for ${cleanHandle}`);
        return pending;
      }

      // Create new request
      const requestPromise = this.performFetch(cleanHandle);
      this.pendingRequests.set(cleanHandle, requestPromise);

      try {
        const result = await requestPromise;

        // Cache the result
        this.cache.set(cleanHandle, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(cleanHandle);
      }
    } catch (error) {
      console.error('Error fetching fresh follower count:', error);
      return null;
    }
  }

  private async performFetch(cleanHandle: string): Promise<FreshUserData | null> {
    try {
      const response = await fetch(`${this.BASE_URL}/user/handle?handle=${cleanHandle}`);

      if (!response.ok) {
        console.error(`Failed to fetch user data: HTTP ${response.status}`);
        return null;
      }

      const data: UserApiResponse = await response.json();
      return {
        followerCount: data.user.followerCount,
        userId: data.user.id
      };
    } catch (error) {
      console.error('Error in performFetch:', error);
      return null;
    }
  }

  // Method to clear cache if needed
  clearCache(handle?: string) {
    if (handle) {
      const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
      this.cache.delete(cleanHandle);
    } else {
      this.cache.clear();
    }
  }
}

const userService = new UserService();
export default userService;
export type { FreshUserData };

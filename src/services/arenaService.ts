const ARENA_API_BASE = import.meta.env.VITE_STARS_ARENA_API_URL || "https://api.starsarena.com";
const MAX_RETRIES = 5;

export interface ArenaUserStatus {
  username: string;
  exists: boolean;
  followerCount: number;
  twitterHandle: string;
  twitterName: string;
  twitterPicture: string;
  handle: string;
  recentPosts?: {
    content: string;
    timestamp: string;
  }[];
}

export interface ArenaEmptyResponse {
  user: null;
}

export interface ArenaErrorResponse {
  statusCode: number;
  errorCode: number;
  timestamp: string;
  message: string;
  path: string;
}

class ArenaRateLimitHandler {
  private waitingForRateLimit: boolean = false;

  private async handleRateLimit(error: ArenaErrorResponse): Promise<void> {
    this.waitingForRateLimit = true;

    const resetTime = new Date(error.timestamp);
    const waitTime = resetTime.getTime() - Date.now();

    console.log(
      `Rate limit exceeded. Waiting until ${resetTime.toLocaleString()} (${Math.ceil(
        waitTime / 1000
      )} seconds)`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime + 1000)); // Add 1 second buffer

    this.waitingForRateLimit = false;
  }

  async call<T>(method: () => Promise<T>): Promise<T> {
    let attempts = 0;

    while (true) {
      try {
        if (this.waitingForRateLimit) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        return await method();
      } catch (error: any) {
        if (++attempts > MAX_RETRIES) {
          throw error;
        }

        if (error.statusCode === 429) {
          await this.handleRateLimit(error);
          continue;
        }

        if (error.message.includes("fetch failed")) {
          console.warn(
            `Fetch failed, retrying attempt ${attempts}/${MAX_RETRIES}...`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        throw error;
      }
    }
  }
}

const rateLimitHandler = new ArenaRateLimitHandler();

const checkUsernameAvailability = async (
  username: string
): Promise<ArenaUserStatus> => {
  try {
    const response = await rateLimitHandler.call(async () => {
      const res = await fetch(
        `${ARENA_API_BASE}/user/handle?handle=${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        const errorData: ArenaErrorResponse = await res.json();
        if (errorData.statusCode === 429) {
          throw errorData;
        }
        return { user: null };
      }

      const data = await res.json();
      console.log("Arena API Response:", { username, data });
      return data;
    });

    console.log("Processed Response:", { username, response });

    // Check if user exists and has valid data in response
    if (!response.user || !response.user.handle) {
      return {
        username,
        exists: false,
        followerCount: 0,
        twitterHandle: "",
        twitterName: "",
        twitterPicture: "",
        handle: "",
      };
    }

    // User exists, check if it has valid data
    const isValidUser =
      response.user.handle &&
      response.user.followerCount !== undefined &&
      response.user.followerCount !== null &&
      (response.user.twitterPicture || response.user.handle);

    // Return data with exists: true only if all validation passes
    const userData = {
      username,
      exists: isValidUser,
      followerCount: response.user.followerCount || 0,
      twitterHandle: response.user.twitterHandle || "",
      twitterName: response.user.twitterName || "",
      twitterPicture: response.user.twitterPicture || "",
      handle: response.user.handle || "",
    };

    console.log("Returning User Data:", userData);
    return userData;
  } catch (error) {
    console.error(`Error checking username ${username}:`, error);
    return {
      username,
      exists: false,
      followerCount: 0,
      twitterHandle: "",
      twitterName: "",
      twitterPicture: "",
      handle: "",
    };
  }
};

export const batchCheckUsernames = async (
  usernames: string[],
  onProgress?: (checked: number, total: number) => boolean
): Promise<ArenaUserStatus[]> => {
  const results: ArenaUserStatus[] = [];
  let checked = 0;

  try {
    // Process all usernames in the batch in parallel
    const promises = usernames.map((username) =>
      checkUsernameAvailability(username)
    );
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Update progress once for the whole batch
    checked = usernames.length;
    const shouldStop = onProgress?.(checked, usernames.length) || false;

    // If we should stop, return what we have so far
    if (shouldStop) {
      console.log("Username checking stopped by request");
    }
  } catch (error) {
    console.error("Error in batch processing:", error);
  }

  return results;
};

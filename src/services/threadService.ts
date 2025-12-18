interface ArenaThread {
  id: string;
  content?: string;
  contentUrl?: string;
  threadType?: string;
  userId?: string;
  userName?: string;
  userHandle?: string;
  userPicture?: string;
  createdDate?: string;
  updatedAt?: string;
  images?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
  user?: {
    id?: string;
    userName?: string;
    userHandle?: string;
    twitterName?: string;
    twitterHandle?: string;
    handle?: string;
    userPicture?: string;
    profilePicture?: string;
    twitterPicture?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ThreadsResponse {
  threads?: ArenaThread[];
}

class ThreadService {
  private readonly BASE_URL = import.meta.env.VITE_STARS_ARENA_API_URL || "https://api.arena.social";

  async fetchRecentThreadsByUserId(
    userId: string,
    page = 1,
    pageSize = 10
  ): Promise<ArenaThread[]> {
    if (!userId) {
      throw new Error("User ID is required to fetch threads");
    }

    const params = new URLSearchParams({
      userId,
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await fetch(
      `${this.BASE_URL}/threads/feed/user?${params.toString()}`
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to fetch threads (HTTP ${response.status}): ${body}`
      );
    }

    const data: ThreadsResponse = await response.json();
    return Array.isArray(data.threads) ? data.threads : [];
  }
}

const threadService = new ThreadService();
export default threadService;
export type { ArenaThread };

interface LeaderboardEntry {
  address: string;
  old_score: number;
  new_score: number;
  updated_at: string;
  username?: string;
  pfp_url?: string;
  arenaUserId?: string;
}

const normalizeScore = (score: number): number => {
  return score / 1e18;
};

interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  count: number;
}

class LeaderboardService {
  private readonly DEFAULT_BASE_URL = import.meta.env.VITE_ENGAGE_API_URL || "http://paid4.daki.cc:4008";

  private normalizeEntries(raw: LeaderboardResponse): LeaderboardEntry[] {
    if (!raw?.success) return [];
    return raw.data.map((entry) => ({
      ...entry,
      old_score: normalizeScore(entry.old_score),
      new_score: normalizeScore(entry.new_score),
    }));
  }

  private buildUrlCandidates(path: string): string[] {
    const normalizedPath = path.startsWith("/")
      ? path
      : `/${path}`;

    const fallbackUrl = `${this.DEFAULT_BASE_URL}${normalizedPath}`;
    const configuredBase = import.meta.env.VITE_BACKEND_API_URL?.replace(/\/$/, "");

    if (!configuredBase) {
      return [fallbackUrl];
    }

    const absoluteUrl = `${configuredBase}${normalizedPath}`;
    const isHttpsContext =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const preferRelative =
      isHttpsContext && absoluteUrl.startsWith("http://");

    if (preferRelative) {
      return [fallbackUrl, absoluteUrl];
    }

    if (absoluteUrl === fallbackUrl) {
      return [absoluteUrl];
    }

    return [absoluteUrl, fallbackUrl];
  }

  private async fetchLeaderboard(path: string): Promise<LeaderboardEntry[]> {
    const urls = this.buildUrlCandidates(path);

    for (const url of urls) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`Failed to fetch leaderboard from ${url}: HTTP ${response.status}`);
          continue;
        }

        const data: LeaderboardResponse = await response.json();
        return this.normalizeEntries(data);
      } catch (error) {
        console.error(`Error fetching leaderboard from ${url}:`, error);
      }
    }

    return [];
  }

  async getUserLeaderboardRaw(): Promise<LeaderboardEntry[]> {
    return this.fetchLeaderboard("/leaderboard/users");
  }

  async getPromoterLeaderboardRaw(): Promise<LeaderboardEntry[]> {
    return this.fetchLeaderboard("/leaderboard/promoters");
  }

  // Backward-compatible methods (still available if used elsewhere)
  async getUserLeaderboard(): Promise<LeaderboardEntry[]> {
    const raw = await this.getUserLeaderboardRaw();
    return raw;
  }

  async getPromoterLeaderboard(): Promise<LeaderboardEntry[]> {
    const raw = await this.getPromoterLeaderboardRaw();
    return raw;
  }

  // Deprecated enrichment method stub for compatibility
  async enrichUserInfo(
    entries: LeaderboardEntry[],
    _start: number,
    _count: number,
    _concurrency: number = 4
  ): Promise<LeaderboardEntry[]> {
    return entries;
  }
}

const leaderboardService = new LeaderboardService();
export default leaderboardService;
export type { LeaderboardEntry };

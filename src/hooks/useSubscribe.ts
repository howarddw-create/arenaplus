import { useState } from "react";
import { ethers } from "ethers";
import { subscribeToToken } from "../services/post2earnService";
import { WalletInfo } from "../types";

export const useSubscribe = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const subscribe = async (tokenAddress: string, months: number, wallet: WalletInfo | null) => {
    if (!wallet) {
      setStatus({ type: "error", message: "Wallet is not connected" });
      return false;
    }

    if (!ethers.isAddress(tokenAddress)) {
      setStatus({ type: "error", message: "Invalid token address" });
      return false;
    }

    setLoading(true);
    setStatus(null);

    try {
      let arenaUserId = "";
      
      // Fetch user ID from arena.social cookie via background script
      try {
        const response: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "GET_ARENA_USER_ID" }, resolve);
        });
        if (response?.userId) {
          arenaUserId = response.userId;
        }
      } catch (e) {
        console.warn("Failed to get arenaUserId from cookie", e);
      }

      console.log("Retrieved Arena User ID:", arenaUserId);

      if (!arenaUserId) {
          throw new Error("Could not determine Arena User ID. Please go to the Profile tab and login first.");
      }

      await subscribeToToken(tokenAddress, arenaUserId, months);

      setStatus({ type: "success", message: "Successfully subscribed!" });
      return true;
    } catch (err: any) {
      console.error("Subscription error:", err);
      setStatus({ type: "error", message: err.message || "Subscription failed" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { subscribe, loading, status, setStatus };
};

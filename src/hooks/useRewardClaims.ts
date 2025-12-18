import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { WalletInfo } from "../types";
import post2EarnAbi from "../contract/Post2EarnABI.json";
import legacyPost2EarnAbi from "../contract/legacyPost2EarnABI.json";
import post2EarnAddress from "../contract/Post2EarnCA.json";
import { AVALANCHE_RPC, ARENA_TOKEN } from "../constants";

export interface UnclaimedReward {
  promotionId: number;
  rewardFormatted: string;
  rewardRaw: bigint;
  expiresOn: number;
  promoter: string;
  promotionType: number;
  source: "v2" | "legacy";
  rewardToken: string;
  contractAddress: string;
}

interface UseRewardClaimsResult {
  rewards: UnclaimedReward[];
  loading: boolean;
  error: string | null;
  claimingId: number | null;
  claimReward: (promotionId: number, source: "v2" | "legacy") => Promise<string>;
  refresh: () => Promise<void>;
}

const {
  POST2_EARN_CONTRACT_ADDRESS,
  LEGACY_POST2_EARN_CONTRACT_ADDRESS,
} = post2EarnAddress;

export const useRewardClaims = (
  wallet: WalletInfo | null | undefined
): UseRewardClaimsResult => {
  const [rewards, setRewards] = useState<UnclaimedReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const loadRewards = useCallback(async () => {
    if (!wallet?.address) {
      setRewards([]);
      return;
    }

    if (!POST2_EARN_CONTRACT_ADDRESS || !ethers.isAddress(POST2_EARN_CONTRACT_ADDRESS)) {
      setError("Invalid Post2Earn contract address");
      setRewards([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
      const v2Contract = new ethers.Contract(
        POST2_EARN_CONTRACT_ADDRESS,
        (post2EarnAbi as any).abi,
        provider
      );

      const legacyContract = new ethers.Contract(
        LEGACY_POST2_EARN_CONTRACT_ADDRESS,
        (legacyPost2EarnAbi as any).abi,
        provider
      );

      const [v2RewardsRaw, legacyRewardsRaw] = await Promise.all([
        v2Contract.getUnclaimedRewards(wallet.address).catch((e: any) => {
            console.warn("Failed to fetch V2 rewards", e);
            return [];
        }),
        legacyContract.getUnclaimedRewards(wallet.address).catch((e: any) => {
            console.warn("Failed to fetch legacy rewards", e);
            return [];
        }),
      ]);

      const processRewards = async (
        ids: bigint[],
        contract: ethers.Contract,
        source: "v2" | "legacy",
        contractAddress: string
      ) => {
        if (!ids.length) return [];
        return Promise.all(
          ids.map(async (idBig) => {
            try {
              const promotionId = Number(idBig);
              const details = await contract.getPromotionDetails(promotionId);

              const rewardPerSlotRaw = BigInt(
                (details.rewardPerSlot as any)?.toString?.() ?? details.rewardPerSlot
              );
              const rewardFormatted = ethers.formatUnits(
                rewardPerSlotRaw,
                ARENA_TOKEN?.decimals ?? 18
              );

              return {
                promotionId,
                rewardFormatted,
                rewardRaw: rewardPerSlotRaw,
                expiresOn: Number((details.expiresOn as any) ?? 0),
                promoter: String((details.promoter as any) ?? ""),
                promotionType: Number((details.promotionType as any) ?? 0),
                source,
                rewardToken: (details.token as string) || (details.rewardToken as string) || ARENA_TOKEN.address,
                contractAddress,
              } satisfies UnclaimedReward;
            } catch (err) {
              console.warn(`Failed to fetch details for reward ${idBig}`, err);
              return null;
            }
          })
        );
      };

      const [v2Processed, legacyProcessed] = await Promise.all([
        processRewards(v2RewardsRaw, v2Contract, "v2", POST2_EARN_CONTRACT_ADDRESS),
        processRewards(legacyRewardsRaw, legacyContract, "legacy", LEGACY_POST2_EARN_CONTRACT_ADDRESS),
      ]);

      const allRewards = [...v2Processed, ...legacyProcessed].filter(
        (r): r is UnclaimedReward => r !== null
      );

      setRewards(
        allRewards.sort((a, b) => a.expiresOn - b.expiresOn)
      );
    } catch (err: any) {
      console.error("Failed to load unclaimed rewards", err);
      setError(err?.message || "Failed to load unclaimed rewards");
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  const claimReward = useCallback(
    async (promotionId: number, source: "v2" | "legacy") => {
      if (!wallet?.privateKey) {
        throw new Error("Wallet is locked. Unlock to claim rewards.");
      }

      const targetAddress = source === "legacy"
        ? LEGACY_POST2_EARN_CONTRACT_ADDRESS
        : POST2_EARN_CONTRACT_ADDRESS;

      const targetAbi = source === "legacy"
        ? (legacyPost2EarnAbi as any).abi
        : (post2EarnAbi as any).abi;

      if (!targetAddress || !ethers.isAddress(targetAddress)) {
        throw new Error("Invalid contract address");
      }

      try {
        setClaimingId(promotionId);
        const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
        const signer = new ethers.Wallet(wallet.privateKey, provider);
        const contract = new ethers.Contract(
          targetAddress,
          targetAbi,
          signer
        );

        const tx = await contract.claimReward(promotionId);
        await tx.wait();
        await loadRewards();
        return tx.hash as string;
      } catch (err: any) {
        console.error("Failed to claim reward", err);
        const message =
          err?.reason ||
          err?.shortMessage ||
          err?.data?.message ||
          err?.error?.message ||
          err?.message ||
          "Failed to claim reward";
        throw new Error(message);
      } finally {
        setClaimingId(null);
      }
    },
    [wallet?.privateKey, loadRewards]
  );

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  return {
    rewards,
    loading,
    error,
    claimingId,
    claimReward,
    refresh: loadRewards,
  };
};

export default useRewardClaims;

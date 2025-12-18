import { useEffect, useState } from "react";
import { ethers } from "ethers";
import vestingAbi from "../contract/LinearTokenVesting.json";
import contractAddress from "../contract/LinearTokenVestingCA.json";
import { AVALANCHE_RPC } from "../constants";

export interface VestingData {
  totalVested: string;
  claimed: string;
  claimable: string;
  startTime: number;
  endTime: number;
  owner: string;
}

export const useTokenVesting = (walletAddress?: string) => {
  const [data, setData] = useState<VestingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!walletAddress) return;
    try {
      setLoading(true);
      setError(null);
      const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
      const vestingContract = new ethers.Contract(
        (contractAddress as { contract_address: string }).contract_address,
        (vestingAbi as any).abi,
        provider
      );

      const [totalVestedBn, claimedBn, claimableBn, start, end, owner] =
        await Promise.all([
          vestingContract.totalVested(),
          vestingContract.claimed(),
          vestingContract.claimable(),
          vestingContract.startTime(),
          vestingContract.endTime(),
          vestingContract.owner(),
        ]);

      setData({
        totalVested: ethers.formatEther(totalVestedBn),
        claimed: ethers.formatEther(claimedBn),
        claimable: ethers.formatEther(claimableBn),
        startTime: Number(start),
        endTime: Number(end),
        owner,
      });
    } catch (err: any) {
      console.error("Error loading vesting data", err);
      setError(err.message || "Failed to load vesting data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  return { data, loading, error, refresh: loadData };
};

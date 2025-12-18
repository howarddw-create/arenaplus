import { ethers } from "ethers";

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const;

export type Erc20Metadata = {
  tokenAddress: string;
  symbol?: string;
  name?: string;
  decimals?: number;
};

export async function fetchErc20Metadata(
  provider: ethers.Provider,
  tokenAddress: string
): Promise<Erc20Metadata | null> {
  if (!ethers.isAddress(tokenAddress) || tokenAddress === ethers.ZeroAddress) {
    return null;
  }

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [symbol, name, decimalsRaw] = await Promise.all([
    contract.symbol().catch(() => null),
    contract.name().catch(() => null),
    contract.decimals().catch(() => null),
  ]);

  const decimals =
    decimalsRaw == null
      ? undefined
      : typeof decimalsRaw === "bigint"
        ? Number(decimalsRaw)
        : Number(decimalsRaw);

  return {
    tokenAddress,
    symbol: symbol || undefined,
    name: name || undefined,
    decimals: Number.isFinite(decimals as number) ? decimals : undefined,
  };
}


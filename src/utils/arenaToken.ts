import { formatUnits } from 'viem';

export const ARENA_TOKEN_ADDRESS = '0xB8d7710f7d8349A506b75dD184F05777c82dAd0C';
export const ARENA_TOKEN_CHAIN = 'avalanche';
export const ARENA_TOKEN_DECIMALS = 18;

export const toArenaNumber = (
  rawAmount: string | bigint | number | null | undefined,
  decimals: number = ARENA_TOKEN_DECIMALS
): number => {
  if (rawAmount === null || rawAmount === undefined) return 0;

  try {
    if (typeof rawAmount === 'number') {
      return Number.isFinite(rawAmount) ? rawAmount : 0;
    }
    const bigintValue = typeof rawAmount === 'bigint'
      ? rawAmount
      : BigInt(rawAmount.toString());
    return Number(formatUnits(bigintValue, decimals));
  } catch (error) {
    const numericFallback = Number(rawAmount);
    return Number.isFinite(numericFallback) ? numericFallback : 0;
  }
};

export const formatUsdValue = (
  value: number | null | undefined,
  { fallback = '--', precision }: { fallback?: string; precision?: { minimumFractionDigits: number; maximumFractionDigits: number } } = {}
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  const abs = Math.abs(value);
  let min = 2;
  let max = 2;

  if (precision) {
    min = precision.minimumFractionDigits;
    max = precision.maximumFractionDigits;
  } else if (abs < 1) {
    min = 4;
    max = abs < 0.01 ? 6 : 4;
  }

  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })}`;
};

/**
 * Formats a token amount with the specified number of decimal places
 * and optionally shortens large numbers with suffixes (K, M, B, T)
 *
 * @param amount - The token amount as a string or number
 * @param decimals - Number of decimal places to show (default: 4)
 * @param useShorthand - Whether to use shorthand notation for large numbers (default: true)
 * @returns Formatted string representation of the amount
 */
export const formatTokenAmount = (
  amount: string | number,
  decimals = 4,
  useShorthand = true
): string => {
  // Convert to number if it's a string
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  // Handle invalid or zero amounts
  if (isNaN(numAmount) || numAmount === 0) {
    return "0";
  }

  // If the number is very small (less than 0.0001), show in scientific notation
  if (numAmount > 0 && numAmount < 0.0001) {
    return numAmount.toExponential(2);
  }

  // For shorthand notation
  if (useShorthand) {
    const absAmount = Math.abs(numAmount);

    if (absAmount >= 1_000_000_000_000) {
      return (numAmount / 1_000_000_000_000).toFixed(decimals) + "T";
    } else if (absAmount >= 1_000_000_000) {
      return (numAmount / 1_000_000_000).toFixed(decimals) + "B";
    } else if (absAmount >= 1_000_000) {
      return (numAmount / 1_000_000).toFixed(decimals) + "M";
    } else if (absAmount >= 1_000) {
      return (numAmount / 1_000).toFixed(decimals) + "K";
    }
  }

  // For regular numbers, format with the specified number of decimal places
  // Remove trailing zeros after the decimal point
  return numAmount.toFixed(decimals).replace(/\.?0+$/, "");
};

/**
 * Formats a token balance for display, removing trailing zeros
 * and handling different decimal places based on the token type
 *
 * @param balance - The token balance as a string
 * @param symbol - The token symbol (used to determine decimal places)
 * @returns Formatted balance string
 */
export const formatTokenBalance = (balance: string, symbol: string): string => {
  const numBalance = parseFloat(balance);

  if (isNaN(numBalance)) {
    return "0";
  }

  // Use different decimal places based on token type
  const decimals = symbol === "AVAX" ? 6 : 4;

  return formatTokenAmount(numBalance, decimals);
};

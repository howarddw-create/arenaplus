type ArenaPriceResult =
  | { success: true; price: number; data?: unknown }
  | { success: false; price: number; error: string };

// Function to fetch ARENA token price from DexScreener API
export async function fetchArenaTokenPrice(): Promise<ArenaPriceResult> {
  const chainId = "avalanche";
  const tokenAddress = "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C";

  try {
    const response = await fetch(
      `${import.meta.env.VITE_DEXSCREENER_API_URL || "https://api.dexscreener.com/latest"}/dex/tokens/v1/${chainId}/${tokenAddress}`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (data && Array.isArray(data) && data.length > 0) {
      const tokenData = data[0];
      if (tokenData.priceUsd) {
        const price = parseFloat(tokenData.priceUsd);
        return { success: true, price, data: tokenData };
      }
    }

    return await fetchArenaTokenPriceFromSearch();
  } catch (error) {
    console.error("Error in fetchArenaTokenPrice:", error);
    return await fetchArenaTokenPriceFromSearch();
  }
}

async function fetchArenaTokenPriceFromSearch(): Promise<ArenaPriceResult> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_DEXSCREENER_API_URL || "https://api.dexscreener.com/latest"}/dex/search?q=ARENA`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (data?.pairs && data.pairs.length > 0) {
      const arenaPairs = data.pairs.filter(
        (pair: any) =>
          pair.baseToken?.symbol === "ARENA" &&
          pair.priceUsd &&
          parseFloat(pair.priceUsd) > 0
      );

      if (arenaPairs.length > 0) {
        const priceUsd = parseFloat(arenaPairs[0].priceUsd);
        return { success: true, price: priceUsd, data: arenaPairs[0] };
      }
    }

    return { success: false, price: 0.004848, error: "No ARENA pairs found" };
  } catch (error) {
    console.error("Error in fetchArenaTokenPriceFromSearch:", error);
    return { success: false, price: 0.004848, error: String(error) };
  }
}


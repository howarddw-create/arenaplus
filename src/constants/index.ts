export const AVALANCHE_RPC = import.meta.env.VITE_AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

// ERC20 Token Interface
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  image: string;
  abi?: any[];
  isNative?: boolean;
  isRounded?: boolean;
}

export const TOKENS: TokenConfig[] = [
  {
    symbol: "AVAX",
    name: "Avalanche",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    decimals: 18,
    image: "/avax.svg",
    isNative: true,
  },
  {
    symbol: "PLUS",
    name: "Plus",
    address: "0x79F7a9a5AD9a2E3243D4E483DdB024093821C011",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "ARENA",
    name: "Arena",
    address: "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C",
    decimals: 18,
    image: "/arena.png", // Keep fallback
    abi: ERC20_ABI,
  },
  {
    symbol: "CAST",
    name: "Cast",
    address: "0xE3f3EF63f193f001D72bb623cA6eCe3E71451D3f",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
  },
  {
    symbol: "COOK",
    name: "Cook",
    address: "0x0AC46f6c3CB77C985E6b21C09Ff71365bE4DE9f3",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "MOOCH",
    name: "Mooch",
    address: "0xEFA670F00447b13d92b639E06829079ED16498ab",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
  },
  {
    symbol: "ATD",
    name: "ATD",
    address: "0xEE61D1195B5c61D1bd5a3E28445F3c922F538C39",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "JUICY",
    name: "Juicy",
    address: "0xC654721fBf1F374fd9FfA3385Bba2F4932A6af55",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "PUSH",
    name: "Push",
    address: "0x555401D23d7baC4DDD6c919433917785353d937D",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "HAT",
    name: "Hat",
    address: "0x323188374CB7CbC6c0C00967Db331e7889E7fC20",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "AYNE",
    name: "AYNE",
    address: "0xeA325Ccc2b98DD04d947a9E68C27C8daE6ad0F7E",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
  {
    symbol: "OK",
    name: "OK",
    address: "0x6ebf68fdc5f205e5785f28431b552bb1a4364718",
    decimals: 18,
    image: "", // Fetch via API
    abi: ERC20_ABI,
    isRounded: true,
  },
];

export const TOKENS_MAP: Record<string, TokenConfig> = TOKENS.reduce(
  (acc, token) => {
    acc[token.symbol] = token;
    return acc;
  },
  {} as Record<string, TokenConfig>
);

export const PARTNER_SYMBOLS = ["PLUS", "MOOCH", "ATD", "AYNE"];
export const PARTNER_TOKENS: TokenConfig[] = PARTNER_SYMBOLS.map(
  (symbol) => TOKENS_MAP[symbol]
).filter((token): token is TokenConfig => token !== undefined);

export const ARENA_TOKEN = TOKENS_MAP["ARENA"];
export const AVAX_TOKEN = TOKENS_MAP["AVAX"];
export const PLUS_TOKEN = TOKENS_MAP["PLUS"];

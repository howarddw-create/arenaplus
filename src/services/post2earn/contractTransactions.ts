import { toFunctionSelector, type Abi, type AbiFunction } from 'viem';

import Post2EarnCA from '../../contract/Post2EarnCA.json';
import Post2EarnABI from '../../contract/Post2EarnABI.json';

const ROUTESCAN_BASE_URL = import.meta.env.VITE_ROUTESCAN_API_URL || 'https://cdn.routescan.io/api/evm/all';
const AVALANCHE_CHAIN_ID = '43114';

const { POST2_EARN_CONTRACT_ADDRESS } = Post2EarnCA;

export type ContractTransactionDirection =
  | 'userToContract'
  | 'contractToUser'
  | 'internal';

export interface Post2EarnContractTransaction {
  txHash: string;
  timestamp?: string;
  blockNumber: number;
  chainId: string;
  methodSignature?: string;
  methodName: string;
  methodId?: string;
  value: string;
  status: 'success' | 'failed';
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  fromAddress?: string;
  toAddress?: string;
  direction: ContractTransactionDirection;
  gasLimit?: string;
  gasUsed?: string;
  gasPrice?: string;
}

interface RoutescanAccountRef {
  id?: string;
  isContract?: boolean;
}

interface RoutescanTokenMetadata {
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  detail?: {
    icon?: string;
  };
}

interface RoutescanTokenTransferItem {
  chainId?: string;
  ecosystems?: string[];
  blockNumber?: number;
  tokenAddress?: string;
  from?: RoutescanAccountRef;
  to?: RoutescanAccountRef;
  txHash: string;
  amount?: string;
  createdAt?: string;
  methodId?: string;
  method?: string;
  token?: RoutescanTokenMetadata;
}

interface RoutescanTokenTransferResponse {
  items?: RoutescanTokenTransferItem[];
  link?: {
    next?: string;
    nextToken?: string;
  };
}

const normalizeMethodName = (signature?: string) => {
  if (!signature) return 'unknown';
  const name = signature.split('(')[0]?.trim();
  return name || 'unknown';
};

const buildExplorerUrl = (txHash: string) =>
  `${import.meta.env.VITE_SNOWTRACE_URL || 'https://snowtrace.io'}/tx/${txHash}`;

type MethodLookupEntry = {
  signature?: string;
  name: string;
};

const normalizeSelector = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
};

const createMethodIdLookup = (abi?: Abi) => {
  const map = new Map<string, MethodLookupEntry>();
  if (!abi) return map;
  for (const item of abi) {
    if (item?.type !== 'function' || !item.name) {
      continue;
    }
    try {
      const selector = normalizeSelector(
        toFunctionSelector(item as AbiFunction)
      );
      if (!selector) continue;
      const inputs =
        item.inputs?.map((input) => input.type ?? 'unknown').join(',') ?? '';
      const signature = `${item.name}(${inputs})`;
      map.set(selector, {
        signature,
        name: item.name,
      });
    } catch {
      // Ignore selectors we fail to parse to avoid crashing fetch.
    }
  }
  return map;
};

const methodIdLookup = createMethodIdLookup(Post2EarnABI.abi as Abi | undefined);

const resolveMethodDetails = (signature?: string | null, methodId?: string | null) => {
  if (signature) {
    return {
      signature,
      name: normalizeMethodName(signature),
    };
  }
  if (methodId) {
    const normalized = normalizeSelector(methodId);
    if (normalized) {
      const fallback = methodIdLookup.get(normalized);
      if (fallback) {
        return fallback;
      }
    }
  }
  return {
    name: 'unknown',
  };
};

export interface FetchUserContractTransactionsOptions {
  limit?: number;
  signal?: AbortSignal;
  nextToken?: string | null;
}

export interface UserContractTransactionsResult {
  transactions: Post2EarnContractTransaction[];
  total?: number;
  nextToken?: string;
}

export const fetchUserPost2EarnTransactions = async (
  walletAddress: string,
  options: FetchUserContractTransactionsOptions = {}
): Promise<UserContractTransactionsResult> => {
  if (!walletAddress) {
    return { transactions: [] };
  }

  const { limit = 50, signal, nextToken } = options;
  const params = new URLSearchParams({
    includedChainIds: AVALANCHE_CHAIN_ID,
    limit: String(limit),
    sort: 'desc',
  });
  if (nextToken) {
    params.set('next', nextToken);
  }

  const endpoint = `${ROUTESCAN_BASE_URL}/address/${POST2_EARN_CONTRACT_ADDRESS}/erc20-transfers`;
  const response = await fetch(`${endpoint}?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error('Failed to fetch contract transactions');
  }

  const data: RoutescanTokenTransferResponse = await response.json();
  const walletLower = walletAddress.toLowerCase();
  const contractLower = POST2_EARN_CONTRACT_ADDRESS.toLowerCase();

  const transactions =
    data.items
      ?.map((item): Post2EarnContractTransaction | null => {
        const fromAddress = item.from?.id;
        const toAddress = item.to?.id;

        const fromLower = fromAddress?.toLowerCase();
        const toLower = toAddress?.toLowerCase();

        if (
          !fromLower ||
          !toLower ||
          (fromLower !== walletLower && toLower !== walletLower)
        ) {
          return null;
        }

        let direction: ContractTransactionDirection = 'internal';

        if (fromLower === walletLower && toLower === contractLower) {
          direction = 'userToContract';
        } else if (toLower === walletLower && fromLower === contractLower) {
          direction = 'contractToUser';
        }

        const tokenMeta = item.token;
        const methodDetails = resolveMethodDetails(item.method, item.methodId);
        return {
          txHash: item.txHash,
          timestamp: item.createdAt,
          blockNumber: Number(item.blockNumber ?? 0),
          chainId: item.chainId ?? AVALANCHE_CHAIN_ID,
          methodSignature: methodDetails.signature,
          methodName: methodDetails.name,
          methodId: item.methodId,
          value: item.amount ?? '0',
          status: 'success',
          tokenAddress: item.tokenAddress ?? tokenMeta?.address,
          tokenSymbol: tokenMeta?.symbol,
          tokenName: tokenMeta?.name,
          tokenDecimals: tokenMeta?.decimals,
          fromAddress,
          toAddress,
          direction,
        };
      })
      .filter(
        (item): item is Post2EarnContractTransaction => item !== null
      ) ?? [];

  return {
    transactions,
    total: undefined,
    nextToken: data.link?.nextToken,
  };
};

export const buildContractTxExplorerUrl = (txHash: string) =>
  buildExplorerUrl(txHash);

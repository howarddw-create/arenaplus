import React, { useMemo, useState } from "react";
import { FormField } from "../UI/FormField";
import { formatTokenBalance } from "../../utils/formatters";
import { TOKENS_MAP } from "../../constants";
import { TokenSelect, TokenSelectOption } from "../UI/TokenSelect";
import { useCommunityImages } from "../../hooks/useCommunityImages";

// Hardcoded ARENA token logo (API returns incorrect dog image)
const ARENA_LOGO_URL = `${import.meta.env.VITE_STATIC_ASSETS_URL || 'https://static.starsarena.com'}/uploads/95dc787e-19e4-3cc5-7a2b-1ec4c80f02531747905925081.png`;

export interface TokenOption {
  symbol: string;
  name: string;
  balance: string;
  address?: string;
}

interface TransferFormProps {
  recipientAddress: string;
  setRecipientAddress: (address: string) => void;
  amount: string;
  setAmount: (amount: string) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
  tokenOptions: TokenOption[];
  selectedToken: string;
  setSelectedToken: (token: string) => void;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  recipientAddress,
  setRecipientAddress,
  amount,
  setAmount,
  onSubmit,
  onCancel,
  loading,
  tokenOptions,
  selectedToken,
  setSelectedToken,
}) => {
  const [addressFocused, setAddressFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);

  // Fetch community images for all tokens
  const tokenTickers = tokenOptions.map(t => t.symbol);
  const { communities } = useCommunityImages(tokenTickers);

  const tokenSelectOptions: TokenSelectOption[] = useMemo(
    () =>
      tokenOptions.map((token) => {
        const community = communities[token.symbol.toLowerCase()];
        const staticImage = TOKENS_MAP[token.symbol]?.image || "";

        // Use hardcoded URL for ARENA, then API image, then static image
        const imageUrl = token.symbol.toUpperCase() === 'ARENA'
          ? ARENA_LOGO_URL
          : (community?.photoURL || staticImage || "/arena.png");

        return {
          symbol: token.symbol,
          name: TOKENS_MAP[token.symbol]?.name || token.name,
          image: imageUrl,
          description: `${formatTokenBalance(token.balance, token.symbol)} available`,
          meta: TOKENS_MAP[token.symbol]?.name,
        };
      }),
    [tokenOptions, communities]
  );

  const hasTokens = tokenSelectOptions.length > 0;

  // Derived validation
  const isAddressLike = recipientAddress.trim().startsWith("0x") && recipientAddress.trim().length >= 42;
  const isAmountValid = parseFloat(amount || "0") > 0;
  const canSubmit =
    !loading && hasTokens && !!selectedToken && isAddressLike && isAmountValid;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRecipientAddress(text.trim());
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleMaxAmount = () => {
    if (!selectedToken) return;

    // Find the selected token and use its balance
    const selectedTokenInfo = tokenOptions.find(
      (token) => token.symbol === selectedToken
    );
    if (selectedTokenInfo) {
      setAmount(selectedTokenInfo.balance);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField
        label="Recipient Address"
        id="recipient"
        value={recipientAddress}
        setValue={setRecipientAddress}
        isFocused={addressFocused}
        onFocus={() => setAddressFocused(true)}
        onBlur={() => setAddressFocused(false)}
        placeholder="0x..."
        buttonLabel="Paste"
        onButtonClick={handlePaste}
      />

      {/* Token Selector */}
      <div className="mb-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Select Token
        </label>
        <TokenSelect
          options={tokenSelectOptions}
          value={selectedToken}
          onChange={setSelectedToken}
          placeholder={hasTokens ? "Choose token" : "No tokens found to withdraw!"}
          disabled={!hasTokens}
        />
        {hasTokens ? (
          selectedToken && (
            <div className="mt-1 text-xs text-slate-500">
              Balance: {formatTokenBalance(
                tokenOptions.find((t) => t.symbol === selectedToken)?.balance || "0",
                selectedToken
              )} {selectedToken}
            </div>
          )
        ) : (
          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-600">
            No tokens found to withdraw!
          </div>
        )}
      </div>

      <FormField
        label="Amount"
        id="amount"
        value={amount}
        setValue={setAmount}
        isFocused={amountFocused}
        onFocus={() => setAmountFocused(true)}
        onBlur={() => setAmountFocused(false)}
        placeholder="0.0"
        type="number"
        step="any"
        min="0"
        buttonLabel="Max"
        onButtonClick={handleMaxAmount}
      />

      <div className="pt-1">
        <div className="mb-3 flex w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" /></svg>
          Gas fees will be deducted from your balance.
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-2.5 px-6 gradient-button text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 focus:outline-none"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              "Send"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-6 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
  ;

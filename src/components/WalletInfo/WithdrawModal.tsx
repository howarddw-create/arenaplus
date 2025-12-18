import React, { useEffect } from "react";
import { TransferForm } from "./TransferForm";
import { TokenInfo } from "../../types";
import { CloseButton } from "../UI/CloseButton";
import { TOKENS_MAP } from "../../constants";

interface WithdrawModalProps {
  onClose: () => void;
  recipientAddress: string;
  setRecipientAddress: (address: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  onTransfer: (e: React.FormEvent) => Promise<boolean>;
  loading: boolean;
  transferError: string | null;
  tokens: TokenInfo[];
  selectedToken: string;
  setSelectedToken: (token: string) => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  onClose,
  recipientAddress,
  setRecipientAddress,
  transferAmount,
  setTransferAmount,
  onTransfer,
  loading,
  transferError,
  tokens,
  selectedToken,
  setSelectedToken,
}) => {
  // Default token preference based on TOKENS order
  const firstAvailable = tokens.find((t) => parseFloat(t.balance) > 0);
  const defaultToken = firstAvailable ? firstAvailable.symbol : "";

  // Use the selectedToken from props if available, otherwise use the default
  useEffect(() => {
    if (!selectedToken && defaultToken) {
      setSelectedToken(defaultToken);
    }
  }, [defaultToken, selectedToken, setSelectedToken, tokens]);

  // Prepare token options for the dropdown
  const tokenOptions = tokens
    .filter((t) => parseFloat(t.balance) > 0)
    .map((t) => ({
      symbol: t.symbol,
      name: TOKENS_MAP[t.symbol]?.name || t.symbol,
      balance: t.balance,
      address: t.address,
    }));

  // Handle the transfer and close modal on success
  const handleTransfer = async (e: React.FormEvent) => {
    const success = await onTransfer(e);
    if (success) {
      onClose();
    }
    return success;
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h2 className="text-base font-semibold text-slate-800">
          Withdraw Tokens
        </h2>
        <CloseButton onClick={onClose} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-[92%] py-5">
          {transferError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-700">
              <p className="mb-1 flex items-center font-semibold">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8h.01" />
                  <path d="M11 12h1v4h1" />
                </svg>
                Transfer Error
              </p>
              <p>{transferError}</p>
            </div>
          )}

          <TransferForm
            recipientAddress={recipientAddress}
            setRecipientAddress={setRecipientAddress}
            amount={transferAmount}
            setAmount={setTransferAmount}
            onSubmit={handleTransfer}
            onCancel={onClose}
            loading={loading}
            tokenOptions={tokenOptions}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
          />
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import post2EarnService from "../../services/post2earnService";
import { useWallet } from "../../hooks/useWallet";
import { useSubscribe } from "../../hooks/useSubscribe";
import { Modal } from "../WalletInfo/Modal";
import { CloseButton } from "../UI/CloseButton";

interface SubscribeTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscribeTokenModal: React.FC<SubscribeTokenModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [months, setMonths] = useState(1);
  const [subscriptionFee, setSubscriptionFee] = useState<string | null>(null);

  const { wallet, init } = useWallet();
  const { subscribe, loading, status, setStatus } = useSubscribe();

  useEffect(() => {
    if (isOpen) {
      init();
      setStatus(null);
      const fetchFee = async () => {
        try {
          const fee = await post2EarnService.getSubscriptionFee();
          setSubscriptionFee(fee.toString());
        } catch (error) {
          console.error("Failed to fetch subscription fee", error);
        }
      };
      void fetchFee();
    }
  }, [isOpen, init, setStatus]);

  const handleSubscribe = async () => {
    const success = await subscribe(tokenAddress, months, wallet);
    if (success) {
        setTokenAddress("");
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen>
      <div className="flex h-full w-full flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-title text-[0.65rem]">Registry</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">
              Subscribe to Token
            </h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-[92%] space-y-6 py-6">
            
            <div className="space-y-4">
                <div>
                <label className="text-xs font-semibold text-slate-500">Token Address</label>
                <input
                    type="text"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                </div>

                <div>
                <label className="text-xs font-semibold text-slate-500">Duration (Months)</label>
                <div className="mt-1 flex gap-2">
                    {[1, 2, 6].map((m) => {
                      const cost = subscriptionFee ? ethers.formatEther(BigInt(subscriptionFee) * BigInt(m)) : null;
                      return (
                        <button
                            key={m}
                            onClick={() => setMonths(m)}
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors flex flex-col items-center justify-center ${
                            months === m
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                            }`}
                        >
                            <span>{m} Month{m > 1 ? "s" : ""}</span>
                            {cost && <span className="text-[10px] opacity-80">{cost} AVAX</span>}
                        </button>
                      );
                    })}
                </div>
                </div>

                {status && (
                <div className={`rounded-xl px-3 py-2 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {status.message}
                </div>
                )}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-white/60 bg-white/80 px-5 py-4">
            <button
                onClick={handleSubscribe}
                disabled={loading || !tokenAddress || !wallet}
                className="gradient-button w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
            >
                {loading ? "Subscribing..." : !wallet ? "Loading Wallet..." : "Subscribe"}
            </button>
        </div>
      </div>
    </Modal>
  );
};

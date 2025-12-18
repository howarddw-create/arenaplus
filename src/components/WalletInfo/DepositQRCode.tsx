import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CloseButton } from "../UI/CloseButton";

interface DepositQRCodeProps {
  walletAddress: string;
  onClose: () => void;
}

export const DepositQRCode: React.FC<DepositQRCodeProps> = ({
  walletAddress,
  onClose,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Copy success notification */}
      {copySuccess && (
        <div className="pointer-events-none absolute left-0 right-0 top-4 z-20 flex items-center justify-center">
          <div className="flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Address copied!
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur">
        <h2 className="text-base font-semibold text-slate-800">Deposit</h2>
        <CloseButton onClick={onClose} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-[92%] py-6">
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4 rounded-lg border-2 border-blue-100 bg-white p-3 shadow-sm">
              <QRCodeSVG value={walletAddress} size={180} />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Scan QR code or use address below
            </p>

            <div className="relative mt-4 w-full rounded-lg border border-blue-100 bg-blue-50 p-2">
              <p className="pr-8 font-mono text-sm text-slate-800 break-all">
                {walletAddress}
              </p>
              <button
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-blue-600 transition hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                aria-label="Copy address"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { useForm, ValidationError } from "@formspree/react";
import { Modal } from "../WalletInfo/Modal";
import { CloseButton } from "../UI/CloseButton";

// Icon components
const CheckIcon = () => (
  <svg
    className="mx-auto mb-5 h-16 w-16 text-emerald-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const InfoIcon = () => (
  <svg
    className="mr-3 h-6 w-6 flex-shrink-0 text-blue-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ReceiptIcon = () => (
  <svg
    className="h-5 w-5 text-slate-400"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M5 2a1 1 0 00-1 1v1.586l-2.293 2.293A1 1 0 002 7.586V17a1 1 0 001 1h14a1 1 0 001-1V7.586a1 1 0 00-.293-.707L15 4.586V3a1 1 0 00-1-1H5zm0 2h10v1.586l-1.293 1.293A1 1 0 0013 7.586V8H7v-.414a1 1 0 00-.293-.707L5.414 5.586H5V4z"
      clipRule="evenodd"
    />
  </svg>
);

const LinkIcon = () => (
  <svg
    className="h-5 w-5 text-slate-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

interface ListTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ListTokenModal: React.FC<ListTokenModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [state, handleSubmit] = useForm("xyzjbjbe");

  if (!isOpen) return null;

  if (state.succeeded) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} fullScreen>
        <div className="flex h-full w-full flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
            <div>
              <p className="section-title text-[0.65rem]">Listing</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-800">
                Token Submitted
              </h2>
            </div>
            <CloseButton onClick={onClose} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-[92%] py-8 text-center">
              <CheckIcon />
              <p className="text-base font-semibold text-slate-800">
                Submission received!
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Thanks for listing your token. We'll review the details shortly.
              </p>
              <button
                onClick={onClose}
                className="gradient-button mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen>
      <div className="flex h-full w-full flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-title text-[0.65rem]">Listing</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">
              List Your Token
            </h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Modal Body with Scrolling */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-[92%] space-y-6 py-6">
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100/80 bg-gradient-to-r from-blue-50/80 via-white/90 to-emerald-50/70 p-4">
              <InfoIcon />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Action Required
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Please deposit 10 AVAX to the following address:
                </p>
                <p className="mt-2 break-all rounded-xl border border-blue-100/80 bg-white/80 p-3 font-mono text-sm text-slate-800">
                  0xCfa48D2450Efc7eC4b99e763c73D89b011A03e0F
                </p>
              </div>
            </div>

            <form
              id="list-token-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Transaction ID */}
              <div>
                <label
                  htmlFor="transactionId"
                  className="block text-xs uppercase tracking-wide text-slate-400"
                >
                  Transaction ID
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                    <ReceiptIcon />
                  </div>
                  <input
                    type="text"
                    name="transactionId"
                    id="transactionId"
                    required
                    className="w-full rounded-xl border border-white/60 bg-white/80 px-10 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="0x..."
                  />
                </div>
                <ValidationError
                  prefix="Transaction ID"
                  field="transactionId"
                  errors={state.errors}
                  className="mt-1 text-sm text-rose-500"
                />
              </div>

              {/* Drive Link */}
              <div>
                <label
                  htmlFor="driveLink"
                  className="block text-xs uppercase tracking-wide text-slate-400"
                >
                  Token Info Drive Link
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                    <LinkIcon />
                  </div>
                  <input
                    type="url"
                    name="driveLink"
                    id="driveLink"
                    required
                    className="w-full rounded-xl border border-white/60 bg-white/80 px-10 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="https://docs.google.com/..."
                  />
                </div>
                <ValidationError
                  prefix="Drive Link"
                  field="driveLink"
                  errors={state.errors}
                  className="mt-1 text-sm text-rose-500"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-white/60 bg-white/80 px-5 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
              disabled={state.submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="list-token-form"
              className="gradient-button inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              disabled={state.submitting}
            >
              {state.submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

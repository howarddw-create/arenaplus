import React, { useState } from "react";
import { ShowerHead } from "lucide-react";
// import { TokenStatus } from "../TokenDisplay/TokenStatus";
import { FeatureSettings } from "../Settings/FeatureSettings";
import { Tooltip } from "../UI/Tooltip";
import { useFeatures } from "../../hooks/useFeatures";
import { CashMachineSettings } from "../Settings/CashMachineSettings";
import { ListTokenModal } from "../Modals/ListTokenModal";
import { SubscribeTokenModal } from "../Modals/SubscribeTokenModal";
import { SubscribersModal } from "../Modals/SubscribersModal";

interface InventoryTabProps {
  onShowModal: () => void;
}

const handleShowTipShower = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_TIP_SHOWER_MODAL" });
    }
  });
};

export const InventoryTab: React.FC<InventoryTabProps> = ({ onShowModal }) => {
  const {
    features,
    toggleFeature,
    updateCashMachineAmount,
    updateCashMachineToken,
  } = useFeatures();
  const [isListTokenModalOpen, setListTokenModalOpen] = useState(false);
  const [isSubscribeTokenModalOpen, setSubscribeTokenModalOpen] = useState(false);
  const [isSubscribersModalOpen, setSubscribersModalOpen] = useState(false);
  return (
    <>
    <div className="min-h-full">
      <div className="space-y-5">
        {/* Username Finder */}
        <div className="card-section relative p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title text-[0.65rem]">Discover</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-800">Arena User Finder</h3>
            </div>
            <div className="relative ml-2">
              <Tooltip
                content={
                  <div>
                    <p className="mb-2">Find which of your Twitter/X friends are on Arena.</p>
                    <p>Navigate to your profile's following page on X and click the button below to scan and identify Arena users.</p>
                  </div>
                }
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
                  <span className="text-[10px] font-semibold">i</span>
                </div>
              </Tooltip>
            </div>
          </div>
            <button
              onClick={onShowModal}
              className="gradient-button mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z"
                  clipRule="evenodd"
                />
              </svg>
              Show Username Finder
            </button>
          </div>

          {/* Tip Shower */}
          <div className="card-section relative overflow-hidden p-5">
            <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/10 to-emerald-500/10 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="section-title text-[0.65rem]">Automation</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-800">
                  Tip Shower
                </h3>
              </div>
              <div className="relative ml-2">
                <Tooltip
                  content={
                    <div>
                      <p className="mb-2">
                        Automatically tip multiple posts in a row from your home
                        feed.
                      </p>
                      <p>
                        To use this feature, go to arena.social/home and click
                        the button below to get started.
                      </p>
                    </div>
                  }
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
                    <span className="text-[10px] font-semibold">i</span>
                  </div>
                </Tooltip>
              </div>
            </div>

            <button
              onClick={handleShowTipShower}
              className="gradient-button relative z-10 mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
            >
              <ShowerHead className="h-5 w-5 mr-2" />
              Open Tip Shower
            </button>
          </div>

          {/* Subscribe Registry Button */}
          <div className="card-section p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title text-[0.65rem]">Registry</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-800">Subscribe to Token</h3>
              </div>
              <div className="relative ml-2">
                <Tooltip
                  content={
                    <div>
                      <p className="mb-2">
                        Subscribe monthly to keep your ERC-20 reward token active inside Arena Plus promotion flows.
                      </p>
                    </div>
                  }
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
                    <span className="text-[10px] font-semibold">i</span>
                  </div>
                </Tooltip>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setSubscribeTokenModalOpen(true)}
                className="gradient-button flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Subscribe
              </button>
              <button
                onClick={() => setSubscribersModalOpen(true)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Subscribers
              </button>
            </div>
          </div>

          {/* Cash Machine Settings */}
          <div className="card-section p-5">
            <CashMachineSettings
              features={features}
              toggleFeature={toggleFeature}
              updateCashMachineAmount={updateCashMachineAmount}
              updateCashMachineToken={updateCashMachineToken}
              onListTokenClick={() => setListTokenModalOpen(true)}
            />
          </div>

          {/* AI Feature Settings */}
          <div className="card-section p-5">
            <FeatureSettings />
          </div>

          {/* Focus Mode Section */}
          <div className="card-section p-5">
            <div className="flex flex-col">
              <p className="section-title text-[0.65rem]">Workflow</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-800">
                Focus Mode
              </h2>
              <p className="text-xs text-slate-400">
                Toggle F to enable focus mode
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-emerald-50/80 p-4">
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-800">
                  Toggle Focus Mode with F key
                </div>
              </div>
              <button
                onClick={() => toggleFeature("enableFocusMode")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white ${
                  features.enableFocusMode ? "bg-gradient-to-r from-blue-500 to-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    features.enableFocusMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Token Status */}
          {/* <div className="mb-4 pb-4 border-b">
            <h3 className="font-medium text-base mb-2">Token Status</h3>
            <TokenStatus />
          </div> */}
        </div>
      </div>
      <ListTokenModal
        isOpen={isListTokenModalOpen}
        onClose={() => setListTokenModalOpen(false)}
      />
      <SubscribeTokenModal
        isOpen={isSubscribeTokenModalOpen}
        onClose={() => setSubscribeTokenModalOpen(false)}
      />
      <SubscribersModal
        isOpen={isSubscribersModalOpen}
        onClose={() => setSubscribersModalOpen(false)}
      />
    </>
  );
};

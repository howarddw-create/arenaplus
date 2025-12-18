import React, { useMemo } from "react";
import { FeatureFlags } from "../../types/features";
import { Tooltip } from "../UI/Tooltip";
import { PARTNER_TOKENS } from "../../constants";
import { TokenSelect } from "../UI/TokenSelect";
import { useCommunityImages } from "../../hooks/useCommunityImages";

// Hardcoded ARENA token logo (API returns incorrect dog image)
const ARENA_LOGO_URL = `${import.meta.env.VITE_STATIC_ASSETS_URL || 'https://static.starsarena.com'}/uploads/95dc787e-19e4-3cc5-7a2b-1ec4c80f02531747905925081.png`;

interface CashMachineSettingsProps {
  features: FeatureFlags;
  toggleFeature: (feature: keyof FeatureFlags) => void;
  updateCashMachineAmount: (amount: string) => void;
  updateCashMachineToken: (token: string) => void;
  onListTokenClick: () => void;
}

export const CashMachineSettings: React.FC<CashMachineSettingsProps> = ({
  features,
  toggleFeature,
  updateCashMachineAmount,
  updateCashMachineToken,
  onListTokenClick,
}) => {
  // Fetch community images for partner tokens
  const tokenTickers = PARTNER_TOKENS.map(t => t.symbol);
  const { communities } = useCommunityImages(tokenTickers);

  const tipTokenOptions = useMemo(() =>
    PARTNER_TOKENS.map((token) => {
      const community = communities[token.symbol.toLowerCase()];
      // Use hardcoded URL for ARENA, then API image, then static image
      const imageUrl = token.symbol.toUpperCase() === 'ARENA'
        ? ARENA_LOGO_URL
        : (community?.photoURL || token.image || "/arena.png");

      return {
        symbol: token.symbol,
        name: token.name,
        image: imageUrl,
      };
    }),
    [communities]
  );

  return (
    <>
      {/* Cash Machine Section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base text-gray-700">Cash Machine</h2>
        <div className="relative ml-2">
          <Tooltip
            content={
              <div>
                <p>
                  This feature automatically tips PLUS tokens when you like a
                  post.
                </p>
              </div>
            }
            position="right"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
              <span className="text-xs font-semibold">i</span>
            </div>
          </Tooltip>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4 bg-blue-50 p-3 rounded-lg">
        <label className="text-sm font-medium text-gray-700">
          Enable Cash Machine
        </label>
        <button
          onClick={() => toggleFeature("enableCashMachine")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${features.enableCashMachine ? "bg-blue-600" : "bg-gray-200"
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${features.enableCashMachine ? "translate-x-6" : "translate-x-1"
              }`}
          />
        </button>
      </div>
      <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700">
          Tip Amount ({features.cashMachineToken})
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={features.cashMachineAmount}
          onChange={(e) => updateCashMachineAmount(e.target.value)}
          className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />

        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Select Tip Token
          </label>
          <TokenSelect
            options={tipTokenOptions}
            value={features.cashMachineToken}
            onChange={updateCashMachineToken}
            placeholder="Choose token"
          />
        </div>
      </div>
      <div className="text-center mt-4">
        <button
          onClick={onListTokenClick}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Wanna list your token?
        </button>
      </div>
    </>
  );
};

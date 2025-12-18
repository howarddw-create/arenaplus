import React, { useState } from "react";
import { TokenDisplay } from "../WalletInfo/TokenDisplay";
import { TokenConfig } from "../../constants";
import { Modal } from "../WalletInfo/Modal";
import { useCommunityImages } from "../../hooks/useCommunityImages";

interface SupportedTokensProps {
  tokens: TokenConfig[];
  maxVisible?: number;
  useModal?: boolean; // when false, show inline-only, no modal
}

export const SupportedTokens: React.FC<SupportedTokensProps> = ({
  tokens,
  maxVisible = 3,
  useModal = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch community images for all tokens
  const tokenTickers = tokens
    .filter(t => !t.isNative)
    .map(t => t.symbol);
  const { communities } = useCommunityImages(tokenTickers);

  const visibleTokens = tokens.slice(0, maxVisible);
  const remaining = tokens.length - visibleTokens.length;

  return (
    <>
      <div
        onClick={() => useModal && setIsOpen(true)}
        className={`rounded-lg shadow-sm ${
          useModal
            ? "flex items-center bg-white border border-gray-200 pl-2 pr-3 py-1 cursor-pointer"
            : "flex items-center bg-white/80 border border-white/60 px-2 py-1"
        }`}
      >
        <div className={`${useModal ? "flex items-center -space-x-1.5" : "flex items-center -space-x-1 flex-nowrap"}`}>
          {visibleTokens.map((token) => {
            const community = communities[token.symbol.toLowerCase()];
            return (
              <TokenDisplay
                key={token.symbol}
                symbol={token.symbol}
                photoURL={community?.photoURL}
                className={`rounded-full ${useModal ? "w-5 h-5 border-[1.5px] border-white" : "w-5 h-5"}`}
              />
            );
          })}
        </div>
        {remaining > 0 && (
          <span className="ml-2 text-[10px] font-semibold text-gray-600">
            +{remaining}
          </span>
        )}
      </div>

      {useModal && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-black">
              Supported Tokens
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {tokens.map((token) => {
                const community = communities[token.symbol.toLowerCase()];
                return (
                  <div key={token.symbol} className="flex items-center space-x-2">
                    <TokenDisplay 
                      symbol={token.symbol} 
                      photoURL={community?.photoURL}
                      className="w-8 h-8" 
                    />
                    <span className="text-sm font-medium text-black whitespace-nowrap">
                      {token.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

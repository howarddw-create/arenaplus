import React, { useState } from "react";
import { TOKENS_MAP } from "../../constants";

// Hardcoded ARENA token logo (API returns incorrect dog image)
const ARENA_LOGO_URL = `${import.meta.env.VITE_STATIC_ASSETS_URL || 'https://static.starsarena.com'}/uploads/95dc787e-19e4-3cc5-7a2b-1ec4c80f02531747905925081.png`;

interface TokenDisplayProps {
  symbol: string;
  className?: string;
  photoURL?: string | null; // API-fetched image URL
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  symbol,
  className = "w-6 h-6 mr-2 flex items-center justify-center",
  photoURL,
}) => {
  const [imageError, setImageError] = useState(false);
  const token = TOKENS_MAP[symbol];

  // Use hardcoded URL for ARENA token, then API photoURL, then static image
  const imageUrl = symbol.toUpperCase() === 'ARENA'
    ? ARENA_LOGO_URL
    : (photoURL || token?.image || "/arena.png");
  const shouldShowFallback = imageError || (!photoURL && !token?.image && symbol.toUpperCase() !== 'ARENA');

  return (
    <div className={className}>
      {!shouldShowFallback ? (
        <img
          src={imageUrl}
          alt={symbol}
          className="w-full h-full object-cover rounded-full" // Always rounded-full
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 font-semibold text-blue-900 dark:from-blue-900/30 dark:to-blue-800/30 dark:text-blue-100">
          <span className="text-xs">{symbol.slice(0, 2).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
};


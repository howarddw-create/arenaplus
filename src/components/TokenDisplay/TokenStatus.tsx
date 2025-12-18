import React, { useState, useEffect } from "react";

export const TokenStatus: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const data = await chrome.storage.local.get("arenaToken");
        setToken(data.arenaToken || null);
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        setLoading(false);
      }
    };

    checkToken();

    // Listen for token updates
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.arenaToken) {
        setToken(changes.arenaToken.newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-gray-600">Loading token status...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Token Authentication Status */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Authentication Status
        </h3>
        {token ? (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-600 font-medium">Token Active</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-600">Token not loaded yet</span>
          </div>
        )}
      </div>

      {/* JWT Token Details */}
      {token && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">JWT Token</h3>
          <div className="relative">
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-20">
              {token}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(token)}
              className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

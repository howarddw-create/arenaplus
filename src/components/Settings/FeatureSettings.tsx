import React, { useState } from "react";
import { useFeatures } from "../../hooks/useFeatures";
import { Tooltip } from "../UI/Tooltip";

export const FeatureSettings: React.FC = () => {
  const { features, toggleFeature, updateGeminiApiKey } = useFeatures();
  const [highlightApiKey, setHighlightApiKey] = useState(false);

  const handleToggle = (featureName: keyof typeof features) => {
    if (
      !features.geminiApiKey &&
      (featureName === "enableGenerateReplies" ||
        featureName === "enableDigestButton")
    ) {
      if (!features[featureName]) {
        setHighlightApiKey(true);
        return;
      }
    }
    toggleFeature(featureName);
  };

  return (
    <div>
      {/* AI Reply Generator Section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base text-gray-700">AI Reply Generator</h2>
        <div className="relative ml-2">
          <Tooltip
            content={
              <div>
                <p className="mb-2">
                  This feature adds AI-powered reply generation on Arena posts.
                </p>
                <p>
                  When enabled, a "Generate" button will appear next to the
                  reply button on Arena posts, allowing you to create AI-powered
                  responses.
                </p>
              </div>
            }
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
              <span className="text-xs font-semibold">i</span>
            </div>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-blue-50 p-3 rounded-lg">
        <label className="text-sm font-medium text-gray-700">
          Enable AI Reply Generation
        </label>
        <button
          onClick={() => handleToggle("enableGenerateReplies")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            features.enableGenerateReplies ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              features.enableGenerateReplies ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Digest Button Section */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="font-semibold text-base text-gray-700">Digest Feature</h2>
        <div className="relative ml-2">
          <Tooltip
            content={
              <div>
                <p>
                  This feature adds a new sidebar navigation item in
                  arena.social while being in any of feed like "Following,
                  Trenches or Trending" it gives the TLDR of what's happening.
                </p>
              </div>
            }
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
              <span className="text-xs font-semibold">i</span>
            </div>
          </Tooltip>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4 bg-blue-50 p-3 rounded-lg">
        <label className="text-sm font-medium text-gray-700">
          Enable Digest Button
        </label>
        <button
          onClick={() => handleToggle("enableDigestButton")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            features.enableDigestButton ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              features.enableDigestButton ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700">
          Gemini API Key
        </label>
        <input
          type="password"
          value={features.geminiApiKey}
          onChange={(e) => {
            updateGeminiApiKey(e.target.value);
            if (e.target.value) {
              setHighlightApiKey(false);
            }
          }}
          placeholder="Enter your Gemini API key"
          className={`w-full p-2.5 text-sm border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
            highlightApiKey ? "border-red-500" : "border-gray-300"
          }`}
        />
        <p className="text-xs text-gray-500 mt-1.5">
          Get your API key from{" "}
          <a
            href="https://makersuite.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            Google AI Studio
          </a>
        </p>
        {highlightApiKey && (
          <p className="text-xs text-red-600 mt-1">
            A Gemini API key is required to enable this feature.
          </p>
        )}
      </div>
    </div>
  );
};

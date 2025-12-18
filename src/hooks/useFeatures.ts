import { useState, useEffect } from "react";
import { FeatureFlags, DEFAULT_FEATURES } from "../types/features";

export const useFeatures = () => {
  const [features, setFeatures] = useState<FeatureFlags>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const data = await chrome.storage.local.get("features");
      const storedFeatures = data.features || {};
      const mergedFeatures = {
        ...DEFAULT_FEATURES,
        ...storedFeatures,
        engageInPromotion: true,
      } as FeatureFlags;

      if (storedFeatures.engageInPromotion !== true) {
        await chrome.storage.local.set({ features: mergedFeatures });
      }

      setFeatures(mergedFeatures);
    } catch (err) {
      console.error("Error loading features:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureName: keyof FeatureFlags) => {
    if (featureName === "engageInPromotion") {
      const forcedFeatures = { ...features, engageInPromotion: true };
      await chrome.storage.local.set({ features: forcedFeatures });
      setFeatures(forcedFeatures);
      return;
    }

    try {
      const updatedFeatures = {
        ...features,
        [featureName]: !features[featureName],
      };
      await chrome.storage.local.set({ features: updatedFeatures });
      setFeatures(updatedFeatures);

      // Notify content script of feature change
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "FEATURE_TOGGLE",
            feature: featureName,
            enabled: updatedFeatures[featureName],
          });
        }
      });
    } catch (err) {
      console.error("Error toggling feature:", err);
    }
  };

  const updateGeminiApiKey = async (apiKey: string) => {
    try {
      const updatedFeatures = {
        ...features,
        geminiApiKey: apiKey,
      };
      await chrome.storage.local.set({ features: updatedFeatures });
      setFeatures(updatedFeatures);
    } catch (err) {
      console.error("Error updating API key:", err);
    }
  };

  const updateCashMachineAmount = async (amount: string) => {
    try {
      const updatedFeatures = {
        ...features,
        cashMachineAmount: amount,
      };
      await chrome.storage.local.set({ features: updatedFeatures });
      setFeatures(updatedFeatures);
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "CASH_MACHINE_AMOUNT",
            amount,
          });
        }
      });
    } catch (err) {
      console.error("Error updating tip amount:", err);
    }
  };

  const updateCashMachineToken = async (token: string) => {
    try {
      const updatedFeatures = {
        ...features,
        cashMachineToken: token,
      };
      await chrome.storage.local.set({ features: updatedFeatures });
      setFeatures(updatedFeatures);
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "CASH_MACHINE_TOKEN",
            token,
          });
        }
      });
    } catch (err) {
      console.error("Error updating tip token:", err);
    }
  };

  return {
    features,
    loading,
    toggleFeature,
    updateGeminiApiKey,
    updateCashMachineAmount,
    updateCashMachineToken,
  };
};

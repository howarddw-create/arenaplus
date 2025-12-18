export interface FeatureFlags {
  enableGenerateReplies: boolean;
  enableCashMachine: boolean;
  cashMachineAmount: string;
  cashMachineToken: string;
  geminiApiKey: string;
  enableDigestButton: boolean;
  enableFocusMode: boolean;
  engageInPromotion: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  enableGenerateReplies: false,
  enableCashMachine: false,
  cashMachineAmount: "1",
  cashMachineToken: "PLUS",
  geminiApiKey: "",
  enableDigestButton: false,
  enableFocusMode: false,
  engageInPromotion: true,
};

console.log("Content script loaded");

import { injectModal, showModal } from "./userFinder";
import { initGenerateReplies, setGenerateRepliesEnabled } from "./aiReply";
import { initFocusMode, toggleFocusMode } from "./focusMode";
import { initDigestButton, setDigestEnabled } from "./arenadigest";
import { initCashMachine, setCashMachine } from "./cashMachine";
import { initTipShower } from "./tipShower";
import {
  initPromotion,
  openPromotionsListModal,
  setEngagePromotion,
} from "./promotion";

// Function to check if we're on the home route
const isHomeRoute = () => {
  return window.location.pathname === "/home";
};

chrome.storage.local.get("features", (data) => {
  const features = data.features || {
    enableGenerateReplies: false,
    enableFocusMode: false,
    enableDigestButton: false,
    enableCashMachine: false,
    cashMachineAmount: "1",
    cashMachineToken: "PLUS",
    engageInPromotion: true,
  };
  initGenerateReplies(features.enableGenerateReplies);
  initFocusMode(features.enableFocusMode);
  initTipShower();
  // Only initialize digest button on home route
  if (isHomeRoute()) {
    initDigestButton(features.enableDigestButton);
  }
  initCashMachine(
    features.enableCashMachine,
    features.cashMachineAmount,
    features.cashMachineToken
  );
  initPromotion(true);
});

chrome.runtime.onMessage.addListener((message) => {
  if (
    message.type === "SHOW_MODAL" &&
    window.location.href.includes("/following")
  ) {
    injectModal();
    showModal();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "FEATURE_TOGGLE") {
    if (message.feature === "enableGenerateReplies") {
      setGenerateRepliesEnabled(message.enabled);
    } else if (message.feature === "enableFocusMode") {
      toggleFocusMode(message.enabled, false);
    } else if (message.feature === "enableDigestButton" && isHomeRoute()) {
      setDigestEnabled(message.enabled);
    } else if (message.feature === "enableCashMachine") {
      chrome.storage.local.get("features", (data) => {
        const features = data.features || {
          cashMachineAmount: "1",
          cashMachineToken: "PLUS",
        };
        setCashMachine(
          message.enabled,
          features.cashMachineAmount,
          features.cashMachineToken
        );
      });
    } else if (message.feature === "engageInPromotion") {
      setEngagePromotion(true);
    }
  }
  if (message.type === "CASH_MACHINE_AMOUNT") {
    setCashMachine(true, message.amount, undefined);
  }
  if (message.type === "CASH_MACHINE_TOKEN") {
    chrome.storage.local.get("features", (data) => {
      const features = data.features || {
        cashMachineAmount: "1",
        cashMachineToken: "PLUS",
      };
      setCashMachine(true, features.cashMachineAmount, message.token);
    });
  }
  if (message.type === "AREX_SHOW_PROMOTIONS") {
    openPromotionsListModal();
  }
});

// Watch for route changes
let currentPath = window.location.pathname;
const routeObserver = new MutationObserver(() => {
  if (currentPath !== window.location.pathname) {
    currentPath = window.location.pathname;
    // Re-check digest button visibility on route change
    chrome.storage.local.get("features", (data) => {
      const features = data.features || { enableDigestButton: false };
      if (isHomeRoute()) {
        initDigestButton(features.enableDigestButton);
      } else {
        setDigestEnabled(false); // Hide digest button on other routes
      }
    });
  }
});

routeObserver.observe(document.body, { childList: true, subtree: true });


export {};

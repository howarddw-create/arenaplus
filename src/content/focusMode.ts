let isFocusModeActive = false;
let navigationJustOccurred = false;

function injectFocusModeCss() {
  const existingStyle = document.getElementById("focus-mode-style");
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement("style");
  style.id = "focus-mode-style";
  style.textContent = `
    /* Focus Mode CSS */
    .focus-blur {
      filter: blur(8px) !important;
      opacity: 0.2 !important;
      transition: filter 0.3s ease, opacity 0.3s ease !important;
      pointer-events: none !important;
    }

    /* Toast notification for focus mode */
    #focus-mode-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(139, 92, 246, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    #focus-mode-toast.hide {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    .focus-mode-key {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      margin: 0 4px;
      font-family: monospace;
    }
  `;
  document.head.appendChild(style);
}

export function toggleFocusMode(
  forceState?: boolean,
  fromNavigation: boolean = false,
) {
  if (!window.location.href.includes("arena.social")) return;

  if (forceState !== undefined) {
    isFocusModeActive = forceState;
  } else {
    isFocusModeActive = !isFocusModeActive;
  }

  chrome.storage.local.get("features", (data) => {
    const features = data.features || {};
    features.enableFocusMode = isFocusModeActive;
    chrome.storage.local.set({ features });
  });

  if (isFocusModeActive) {
    const rightSidebar = document.querySelector(
      "div.fixed.top-0.flex.max-h-screen.w-full.flex-col.overflow-y-auto.lg\\:w-\\[290px\\].lg\\:px-\\[3px\\].lg\\:py-8.xl\\:w-\\[380px\\].h-full",
    );

    const leftSidebar = document.querySelector(
      "header.relative.z-\\[3\\].hidden.sm\\:flex.sm\\:flex-shrink-0.sm\\:flex-grow.sm\\:flex-col.sm\\:items-end",
    );

    if (rightSidebar) {
      rightSidebar.classList.add("focus-blur");
    }

    if (leftSidebar) {
      leftSidebar.classList.add("focus-blur");
    }

    if (!fromNavigation) {
      showFocusToast("Focus Mode: ON");
    }
  } else {
    document.querySelectorAll(".focus-blur").forEach((el) => {
      el.classList.remove("focus-blur");
    });

    if (!fromNavigation) {
      showFocusToast("Focus Mode: OFF");
    }
  }
}

function showFocusToast(message: string) {
  if (navigationJustOccurred) return;

  const existingToast = document.getElementById("focus-mode-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.id = "focus-mode-toast";
  toast.innerHTML = `${message} <span class="focus-mode-key">F</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function setupFocusModeKeyboardShortcut() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "f" || event.key === "F") {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      toggleFocusMode();

      chrome.storage.local.get("features", (data) => {
        const features = data.features || {};
        features.enableFocusMode = isFocusModeActive;
        chrome.storage.local.set({ features });
      });
    }
  });
}

export function initFocusMode(initial: boolean) {
  injectFocusModeCss();
  setupFocusModeKeyboardShortcut();

  if (initial) {
    toggleFocusMode(true, true);
  }

  let currentUrl = window.location.href;

  const urlObserver = new MutationObserver(() => {
    if (currentUrl !== window.location.href) {
      currentUrl = window.location.href;
      navigationJustOccurred = true;

      if (isFocusModeActive) {
        setTimeout(() => {
          toggleFocusMode(true, true);
          setTimeout(() => {
            navigationJustOccurred = false;
          }, 1000);
        }, 500);
      } else {
        setTimeout(() => {
          navigationJustOccurred = false;
        }, 1000);
      }
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });
}


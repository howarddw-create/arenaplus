import { generateReply } from "../services/aiService";

const logContent = (message: string, ...args: any[]) => {
  console.log(`[Content Script] ${message}`, ...args);
};

let isGenerateEnabled = false;

function injectGenerateButton() {
  // Check if we're on arena.social
  if (!isGenerateEnabled || !window.location.hostname.includes('arena.social')) return;

  const replyButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Reply"
  );

  if (!replyButton || document.querySelector(".generate-button")) return;

  // Skip if it's a Post button context
  if (
    Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Post"
    )
  )
    return;

  const generateButton = document.createElement("button");
  generateButton.textContent = "Generate";
  generateButton.className = `${replyButton.className} generate-button`;

  const baseStyles = `
    background-color: rgb(194, 65, 12);
    color: rgb(255, 255, 255);
    font-weight: 600;
    font-size: 15px;
    padding: 8px 16px;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    transition: background-color 150ms;
    margin-right: 4px;
  `;

  const applyResponsiveStyles = () => {
    generateButton.style.cssText = `
      ${baseStyles}
      ${
        window.innerWidth <= 768
          ? "width: auto; height: 36px; margin-bottom: 0px;"
          : "height: 36px;"
      }
    `;
  };

  applyResponsiveStyles();
  window.addEventListener("resize", applyResponsiveStyles);

  generateButton.addEventListener("mouseenter", () => {
    generateButton.style.backgroundColor = "rgb(154, 52, 18)";
  });

  generateButton.addEventListener("mouseleave", () => {
    generateButton.style.backgroundColor = "rgb(194, 65, 12)";
  });

  // Add click handler
  generateButton.addEventListener("click", async (e) => {
    e.preventDefault();

    // Check if API key is configured
    const data = await chrome.storage.local.get("features");
    const features = data.features || { geminiApiKey: "" };

    if (!features.geminiApiKey) {
      alert("Please configure your Gemini API key in the extension settings");
      return;
    }

    const editor = document.querySelector(
      'div[contenteditable="true"][role="textbox"]'
    ) as HTMLDivElement;
    if (editor) {
      // Disable the button while generating
      generateButton.disabled = true;
      generateButton.style.opacity = "0.5";
      generateButton.style.cursor = "not-allowed";
      generateButton.textContent = "Generating...";

      try {
        logContent("🔍 Starting content extraction...");

        // Get the post content div
        const postContentDiv = document.querySelector(
          'div[class*="post-content"]'
        );
        logContent("📄 Found post content div:", postContentDiv);

        if (!postContentDiv) {
          throw new Error("No post content found");
        }

        // Update the image extraction part
        const textElement = postContentDiv.querySelector("p");

        // Function to try finding the image element
        const findImageElement = () => {
          // First try to find direct sibling img
          const parentDiv = postContentDiv?.parentElement;
          let img = parentDiv?.querySelector(":scope > img");

          // If not found, try other selectors as fallback
          if (!img) {
            img =
              postContentDiv?.querySelector("img") ||
              postContentDiv?.nextElementSibling?.querySelector("img") ||
              null;
          }
          return img;
        };

        // Try to find image with retries
        let imageElement = findImageElement();
        if (!imageElement) {
          // Wait for 500ms and try again
          await new Promise((resolve) => setTimeout(resolve, 500));
          imageElement = findImageElement();
        }

        logContent("🔍 Direct children found:", {
          textElement,
          imageElement,
        });

        const textContent = textElement?.textContent || "";
        const imageUrl = imageElement?.getAttribute("src") || "";

        logContent("💬 Extracted text content:", textContent);
        logContent("🖼️ Found image element:", imageElement);
        logContent("🔗 Extracted image URL:", imageUrl);

        // Clean up the image URL if needed (remove any query parameters)
        const cleanImageUrl = imageUrl.split("?")[0];

        if (!textContent && !imageUrl) {
          throw new Error("No content found to generate reply");
        }

        // Add CORS headers to the image URL
        const corsImageUrl = imageUrl
          ? `https://cors-anywhere.herokuapp.com/${imageUrl}`
          : "";

        logContent("📦 Sending to AI service:", {
          textContent,
          imageUrl: cleanImageUrl,
          hasText: !!textContent,
          hasImage: !!cleanImageUrl,
        });

        // Generate AI reply with context and image
        const reply = await generateReply(
          textContent,
          corsImageUrl || cleanImageUrl
        );
        logContent("✨ Generated reply:", reply);

        // Update the editor with the generated reply
        editor.textContent = reply;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

        // Update button state
        generateButton.textContent = "Generated";
      } catch (error) {
        console.error("❌ Error:", error);
        generateButton.textContent = "Error";
        setTimeout(() => {
          generateButton.textContent = "Generate";
          generateButton.disabled = false;
          generateButton.style.opacity = "1";
          generateButton.style.cursor = "pointer";
        }, 2000);
      }
    }
  });

  const buttonContainer = replyButton.parentElement;
  if (buttonContainer) {
    // Always directly insert the button before the reply button with no wrapper
    buttonContainer.insertBefore(generateButton, replyButton);
  }
}

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      injectGenerateButton();
    }
  }
});

export function initGenerateReplies(initial: boolean) {
  isGenerateEnabled = initial;
  observer.observe(document.body, { childList: true, subtree: true });
  injectGenerateButton();
}

export function setGenerateRepliesEnabled(enabled: boolean) {
  isGenerateEnabled = enabled;
  if (!isGenerateEnabled) {
    const existingButton = document.querySelector(".generate-button");
    existingButton?.parentElement?.removeChild(existingButton);
  } else {
    injectGenerateButton();
  }
}


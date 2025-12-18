import { batchCheckUsernames, ArenaUserStatus } from "../services/arenaService";
import { summarizeUsers } from "../services/aiService";

// Add a flag to track if analysis is in progress
let isAnalysisInProgress = false;
let shouldStopAnalysis = false;
let isCheckingUsernames = false;
let foundArenaUsers: ArenaUserStatus[] = [];
let userPosts = new Map<string, { content: string; timestamp: string }>();

// Simple markdown to HTML converter
function markdownToHtml(text: string): string {
  // Bold: **text** -> <strong>text</strong>
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Newlines to <br>
  text = text.replace(/\n/g, "<br>");
  return text;
}

// Create and inject modal
export function injectModal() {
  if (document.getElementById("custom-modal")) return;

  const modalHTML = `
    <div id="custom-modal" style="
      display: none; 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      z-index: 2147483647; 
      width: 90%; 
      max-width: 480px; 
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      overflow: hidden;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        overflow: hidden;
      ">
        <div style="
          padding: 20px 24px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h2 style="
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: white;
          ">Arena User Finder</h2>
          <div id="close-modal-x" style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            font-size: 14px;
            line-height: 1;
          ">✕</div>
        </div>

        <div style="padding: 24px;">
          <div id="modal-content" style="margin-bottom: 24px;">
            <p style="
              margin: 0 0 16px 0;
              font-size: 15px;
              line-height: 1.5;
              color: #4b5563;
            ">
              Find which of your Twitter/X friends are on Arena. The tool will scan usernames from this following list and check if they have Arena profiles.
            </p>
            <div style="
              padding: 12px;
              background-color: #f3f4f6;
              border-radius: 8px;
              border-left: 3px solid #8b5cf6;
              margin-bottom: 16px;
            ">
              <p style="
                margin: 0;
                font-size: 13px;
                line-height: 1.5;
                color: #4b5563;
              ">
                <span style="font-weight: 600; color: #4b5563;">Note:</span> This process will scroll through your following list to find usernames. You can stop the process at any time.
              </p>
            </div>
          </div>

          <div style="
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          ">
            <button id="close-modal" style="
              padding: 10px 16px;
              font-size: 14px;
              font-weight: 500;
              color: #6b7280;
              background: transparent;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
            ">Cancel</button>
            <button id="start-analysis" style="
              padding: 10px 16px;
              font-size: 14px;
              font-weight: 500;
              color: white;
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              border: none;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clip-rule="evenodd" />
              </svg>
              Start Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="results-modal" style="
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      width: 90%;
      max-width: 480px;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      overflow: hidden;
    ">
      <div style="
        padding: 20px 24px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h2 style="
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: white;
        ">Analysis Results</h2>
        <div id="close-results-x" style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          font-size: 14px;
          line-height: 1;
        ">✕</div>
      </div>
      
      <div style="padding: 16px 24px;">
        <div id="analysis-status" style="
          margin-bottom: 16px;
          padding: 12px;
          background-color: #f3f4f6;
          border-radius: 8px;
          border-left: 3px solid #8b5cf6;
        ">
          <p style="
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            color: #4b5563;
          ">
            <span style="font-weight: 600; color: #4b5563;">Status:</span> 
            <span id="status-text">Scanning usernames...</span>
          </p>
        </div>
        
        <div style="
          margin-bottom: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          overflow: hidden;
          height: 8px;
        ">
          <div id="progress" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            transition: width 0.3s ease;
          "></div>
        </div>
        
        <div id="available-usernames" style="
          margin-bottom: 16px;
          max-height: calc(80vh - 240px);
          overflow-y: auto;
        ">
          <p style="text-align: center; color: #6b7280;">Preparing to scan usernames...</p>
        </div>
        
        <div id="digest-container" style="display: none; margin-bottom: 16px;"></div>
      </div>
      
      <div style="
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      ">
        <button id="generate-digest" style="
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #6366f1;
          background: transparent;
          border: 1px solid #6366f1;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: none; /* Initially hidden */
          align-items: center;
          gap: 8px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3.5a1.5 1.5 0 011.5 1.5v.085a2.5 2.5 0 003.86 2.016l.13.099a1.5 1.5 0 01-1.34 2.592l-.183-.046a2.5 2.5 0 00-3.024 1.41l-.09.16a1.5 1.5 0 01-2.733 0l-.09-.16a2.5 2.5 0 00-3.024-1.41l-.183.046a1.5 1.5 0 01-1.34-2.592l.13-.099a2.5 2.5 0 003.86-2.016V5A1.5 1.5 0 0110 3.5zM10 11a4 4 0 110-8 4 4 0 010 8z" />
            <path d="M6.22 13.25a2.12 2.12 0 011.08-1.528l.004-.002.002-.001a5.002 5.002 0 015.39 0l.002.001.004.002a2.12 2.12 0 011.08 1.528A5.002 5.002 0 0110 18a5.002 5.002 0 01-3.78-1.75z" />
          </svg>
          Generate Digest
        </button>
        <button id="stop-analysis" style="
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #ef4444;
          background: transparent;
          border: 1px solid #ef4444;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
          </svg>
          Stop Analysis
        </button>
        <button id="close-results" style="
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        ">Close</button>
      </div>
    </div>
    <div id="custom-modal-overlay" style="
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 2147483646;
    "></div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  setupModalEventListeners();
}

// Add username finder functionality
async function findUsernames() {
  if (isAnalysisInProgress) return;

  isAnalysisInProgress = true;
  shouldStopAnalysis = false;

  const usernames = new Set<string>();
  let lastHeight = 0;
  const maxScrollAttempts = 100; // Keep this to prevent infinite scrolling
  let scrollAttempts = 0;

  const updateModalContent = (message: string) => {
    const statusText = document.getElementById("status-text");
    if (statusText) {
      statusText.textContent = message;
    }
  };

  const extractUsernames = () => {
    const usernameElements = document.querySelectorAll("span.r-bcqeeo");
    usernameElements.forEach((element) => {
      const username = element.textContent?.trim();
      if (username && username.startsWith("@")) {
        // Find the tweet container
        const tweetContainer = element.closest("article");
        let postContent = "";
        let timestamp = "";

        if (tweetContainer) {
          // Find the main tweet text
          const tweetText = tweetContainer.querySelector(
            '[data-testid="tweetText"]'
          );
          if (tweetText) {
            postContent = tweetText.textContent?.trim() || "";
          }

          // Find the timestamp
          const timeElement = tweetContainer.querySelector("time");
          if (timeElement) {
            timestamp = timeElement.getAttribute("datetime") || "";
          }
        }

        const cleanUsername = username.substring(1);
        if (!usernames.has(cleanUsername)) {
          usernames.add(cleanUsername);
          userPosts.set(cleanUsername, {
            content: postContent,
            timestamp: timestamp,
          });
        }
      }
    });
  };

  updateModalContent("Scanning usernames... Please wait.");

  while (scrollAttempts < maxScrollAttempts && !shouldStopAnalysis) {
    extractUsernames();

    window.scrollTo(0, document.body.scrollHeight);

    // Wait for new content to load
    await new Promise((resolve) => setTimeout(resolve, 800)); // Slightly faster

    // Check if we've reached the bottom
    if (document.body.scrollHeight === lastHeight) {
      scrollAttempts++;
    } else {
      scrollAttempts = 0;
      lastHeight = document.body.scrollHeight;
    }

    // Update status with count
    updateModalContent(`Scanning usernames... Found ${usernames.size} so far.`);

    // If we've found a good number of usernames or made multiple attempts at the same height, break
    if ((usernames.size > 50 && scrollAttempts > 3) || scrollAttempts > 5) {
      break;
    }
  }

  // Reset scroll position
  window.scrollTo(0, 0);

  // If stopped early, update status
  if (shouldStopAnalysis) {
    updateModalContent(`Scanning stopped. Found ${usernames.size} usernames.`);
  } else {
    updateModalContent(`Scanning complete. Found ${usernames.size} usernames.`);
  }

  isAnalysisInProgress = false;

  // If we found usernames, check them - regardless of whether analysis was stopped
  if (usernames.size > 0) {
    const availableUsernamesDiv = document.getElementById(
      "available-usernames"
    );
    if (availableUsernamesDiv) {
      availableUsernamesDiv.innerHTML = `
        <div style="
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 16px;
        ">
          <p style="
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
          ">Found ${usernames.size} usernames</p>
          <p style="
            margin: 0;
            font-size: 13px;
            color: #6b7280;
          ">Checking which ones have Arena profiles...</p>
        </div>
      `;
    }

    // Hide the stop button during checking
    const stopButton = document.getElementById("stop-analysis");
    if (stopButton) {
      stopButton.style.display = "none";
    }

    // Start checking usernames
    checkArenaAvailability(Array.from(usernames));
  } else {
    const availableUsernamesDiv = document.getElementById(
      "available-usernames"
    );
    if (availableUsernamesDiv) {
      availableUsernamesDiv.innerHTML = `
        <div style="
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          text-align: center;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: #6b7280;
          ">No usernames found. Try scrolling manually and then running the analysis again.</p>
        </div>
      `;
    }
  }
}

async function checkArenaAvailability(usernames: string[]) {
  if (isCheckingUsernames) return;
  isCheckingUsernames = true;

  // Reset userPosts for new scan
  userPosts.clear();

  const availableUsernamesDiv = document.getElementById("available-usernames");
  const progressBar = document.getElementById("progress");
  const statusText = document.getElementById("status-text");
  const stopButton = document.getElementById("stop-analysis");

  // Hide the stop button during checking
  if (stopButton) {
    stopButton.style.display = "none";
  }

  if (statusText) {
    statusText.textContent = `Checking Arena profiles (0/${usernames.length})...`;
  }

  try {
    // Process usernames in parallel batches for speed
    const BATCH_SIZE = 5; // Check 5 usernames at a time
    let results: ArenaUserStatus[] = [];

    // Split usernames into batches
    const batches: string[][] = [];
    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      batches.push(usernames.slice(i, i + BATCH_SIZE));
    }

    // Process each batch in sequence, but process usernames within each batch in parallel
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await batchCheckUsernames(batch, (checked, _) => {
        // Update progress for this batch
        const overallChecked = i * BATCH_SIZE + checked;
        const overallTotal = usernames.length;
        const percentage = Math.min(100, (overallChecked / overallTotal) * 100);

        if (progressBar) {
          progressBar.style.width = `${percentage}%`;
        }

        if (statusText) {
          statusText.textContent = `Checking Arena profiles (${overallChecked}/${overallTotal})...`;
        }

        return false; // Never stop the process
      });

      // Add posts to the results
      const resultsWithPosts = batchResults.map((result) => ({
        ...result,
        recentPosts: userPosts.get(result.username)
          ? [userPosts.get(result.username)!]
          : [],
      }));

      results = [...results, ...resultsWithPosts];
    }

    // Keep the stop button hidden after completion
    // No need to show it again

    if (statusText) {
      statusText.textContent = `Analysis complete. Found ${
        results.filter((r) => r.exists).length
      } Arena users.`;
    }

    // Show all valid users - those that exist
    const existingUsers = results.filter((r) => r.exists);
    foundArenaUsers = existingUsers; // Store users

    if (availableUsernamesDiv) {
      if (existingUsers.length === 0) {
        availableUsernamesDiv.innerHTML = `
          <div style="
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
            text-align: center;
          ">
            <p style="
              margin: 0;
              font-size: 14px;
              color: #6b7280;
            ">No Arena profiles found among these Twitter/X users.</p>
          </div>
        `;
      } else {
        availableUsernamesDiv.innerHTML = `
          <div style="margin-bottom: 16px;">
            <h3 style="
              font-size: 16px;
              font-weight: 600;
              color: #374151;
              margin: 0 0 12px 0;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="#8b5cf6">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              Arena Profiles Found (${existingUsers.length})
            </h3>
            <div style="
              display: grid;
              gap: 8px;
            ">
              ${existingUsers
                .map(
                  (user) => `
                <div style="
                  padding: 12px;
                  background: white;
                  border-radius: 8px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                  border: 1px solid #f3f4f6;
                ">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    ${
                      user.twitterPicture
                        ? `
                      <img 
                        src="${user.twitterPicture}" 
                        alt="${user.twitterName || user.username}"
                        style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                        onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 20 20%22 fill=%22%239ca3af%22><path fill-rule=%22evenodd%22 d=%22M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z%22 clip-rule=%22evenodd%22/></svg>';"
                      />
                    `
                        : `
                      <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: #f3f4f6;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #9ca3af;
                        font-weight: 600;
                      ">${user.username.charAt(0).toUpperCase()}</div>
                    `
                    }
                    <div>
                      <div style="color: #374151; font-weight: 500;">@${
                        user.username
                      }</div>
                      <div style="font-size: 12px; color: #6b7280;">
                        ${
                          user.followerCount !== null &&
                          user.followerCount !== undefined
                            ? `${user.followerCount} Arena follower${
                                user.followerCount !== 1 ? "s" : ""
                              }`
                            : "Arena user"
                        }
                      </div>
                    </div>
                  </div>
                  <a
                    href="https://arena.social/${user.username}"
                    target="_blank"
                    style="
                      color: #6366f1;
                      text-decoration: none;
                      font-size: 14px;
                      padding: 6px 12px;
                      border: 1px solid #e5e7eb;
                      border-radius: 6px;
                      transition: all 0.2s;
                      white-space: nowrap;
                    "
                    onmouseover="this.style.backgroundColor='#f9fafb'"
                    onmouseout="this.style.backgroundColor='transparent'"
                  >View Profile</a>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Error checking usernames:", error);

    // Keep the stop button hidden even on error
    // No need to show it again

    if (availableUsernamesDiv) {
      availableUsernamesDiv.innerHTML = `
        <div style="
          padding: 16px;
          background: #fee2e2;
          border-radius: 8px;
          text-align: center;
          border-left: 3px solid #ef4444;
        ">
          <p style="
            margin: 0;
            font-size: 14px;
            color: #b91c1c;
          ">An error occurred while checking usernames. Please try again later.</p>
        </div>
      `;
    }
  } finally {
    isCheckingUsernames = false;

    // Ensure the stop button remains hidden
    if (stopButton) {
      stopButton.style.display = "none";
    }
  }
}

function setupModalEventListeners() {
  const mainModal = document.getElementById("custom-modal");
  const resultsModal = document.getElementById("results-modal");
  const overlay = document.getElementById("custom-modal-overlay");
  const closeButton = document.getElementById("close-modal");
  const closeXButton = document.getElementById("close-modal-x");
  const closeResultsButton = document.getElementById("close-results");
  const closeResultsXButton = document.getElementById("close-results-x");
  const startAnalysisButton = document.getElementById("start-analysis");
  const stopAnalysisButton = document.getElementById("stop-analysis");
  const generateDigestButton = document.getElementById("generate-digest");

  const hideModals = () => {
    if (mainModal) mainModal.style.display = "none";
    if (resultsModal) resultsModal.style.display = "none";
    if (overlay) overlay.style.display = "none";

    // Reset state
    foundArenaUsers = [];
    const digestContainer = document.getElementById("digest-container");
    if (digestContainer) {
      digestContainer.style.display = "none";
      digestContainer.innerHTML = "";
    }
    const digestButton = document.getElementById("generate-digest");
    if (digestButton) {
      digestButton.style.display = "none";
    }

    // Reset scroll position
    window.scrollTo(0, 0);
  };

  if (closeButton) {
    closeButton.addEventListener("click", hideModals);
  }

  if (closeXButton) {
    closeXButton.addEventListener("click", hideModals);
  }

  if (closeResultsButton) {
    closeResultsButton.addEventListener("click", hideModals);
  }

  if (closeResultsXButton) {
    closeResultsXButton.addEventListener("click", hideModals);
  }

  if (startAnalysisButton) {
    startAnalysisButton.addEventListener("click", () => {
      if (mainModal) mainModal.style.display = "none";
      if (resultsModal) resultsModal.style.display = "block";
      if (overlay) overlay.style.display = "block";

      // Reset progress bar
      const progressBar = document.getElementById("progress");
      if (progressBar) progressBar.style.width = "0%";

      // Start analysis
      findUsernames();
    });
  }

  if (stopAnalysisButton) {
    stopAnalysisButton.addEventListener("click", () => {
      if (isAnalysisInProgress) {
        shouldStopAnalysis = true;
        stopAnalysisButton.textContent = "Stopping...";
        stopAnalysisButton.style.opacity = "0.7";
        stopAnalysisButton.style.cursor = "default";

        const statusText = document.getElementById("status-text");
        if (statusText) {
          statusText.textContent = "Stopping analysis...";
        }

        // Add a timeout to reset the button if it gets stuck
        setTimeout(() => {
          if (
            stopAnalysisButton &&
            stopAnalysisButton.textContent === "Stopping..."
          ) {
            stopAnalysisButton.textContent = "Stop Analysis";
            stopAnalysisButton.style.opacity = "1";
            stopAnalysisButton.style.cursor = "pointer";
            isAnalysisInProgress = false;
          }
        }, 10000); // 10 seconds timeout as a failsafe
      }
    });
  }

  if (generateDigestButton) {
    generateDigestButton.addEventListener("click", async () => {
      const digestContainer = document.getElementById("digest-container");
      if (!digestContainer || !foundArenaUsers.length) return;

      digestContainer.style.display = "block";
      digestContainer.innerHTML = `
        <div style="margin-bottom: 12px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #374151; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="#8b5cf6">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Latest Activity Summary
          </h3>
        </div>
        <div style="
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        ">
          <div style="
            font-size: 14px;
            color: #4b5563;
            line-height: 1.8;
          ">
            ${markdownToHtml(await summarizeUsers(foundArenaUsers))}
          </div>
        </div>
      `;
    });
  }

  // Close on overlay click
  if (overlay) {
    overlay.addEventListener("click", hideModals);
  }
}
// Token monitoring functionality has been completely removed

export function showModal() {
  const modal = document.getElementById("custom-modal");
  const overlay = document.getElementById("custom-modal-overlay");

  if (modal) modal.style.display = "block";
  if (overlay) overlay.style.display = "block";
}

import { summarizeUsers } from '../services/aiService';

interface Post {
  username: string;
  handle: string;
  content: string;
  images?: string[];  // Add support for multiple images
}

let isDigestEnabled = false;

async function extractPosts(
  updateStatus: (message: string) => void
): Promise<Post[]> {
  const posts = new Map<string, Post>();
  let lastHeight = 0;
  let attempts = 0;

  updateStatus("Scanning for posts...");

  while (posts.size < 20 && attempts < 5) {
    const postContentElements = document.querySelectorAll("div.post-content");

    postContentElements.forEach((postContentEl) => {
      const mainContentContainer = postContentEl.closest(
        ".flex.w-full.min-w-0.flex-col.gap-2"
      );
      if (!mainContentContainer) return;

      const usernameEl = mainContentContainer.querySelector("a.font-semibold");
      const handleEl = mainContentContainer.querySelector("a.truncate");
      const content = (postContentEl as HTMLElement).innerText;

      // Find images in the post
      const images: string[] = [];
      const imageElements = mainContentContainer.querySelectorAll('img[src*="pbs.twimg.com"]');
      imageElements.forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src && !src.includes('profile_images')) {  // Exclude profile pictures
          images.push(src);
        }
      });

      if (
        usernameEl &&
        handleEl &&
        usernameEl.textContent &&
        handleEl.textContent &&
        content
      ) {
        const postData: Post = {
          username: usernameEl.textContent,
          handle: handleEl.textContent,
          content: content,
          images: images.length > 0 ? images : undefined
        };
        if (!posts.has(content)) {
          posts.set(content, postData);
        }
      }
    });

    if (posts.size >= 20) {
      break;
    }

    updateStatus(`Found ${posts.size} posts, scanning for more...`);
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) {
      attempts++;
    } else {
      lastHeight = newHeight;
      attempts = 0;
    }
  }

  return Array.from(posts.values()).slice(0, 20);
}

async function renderPostsInModal(posts: Post[], modalContentElement: HTMLElement) {
  if (posts.length === 0) {
    modalContentElement.innerHTML = "<p>No posts found on the current page.</p>";
    return;
  }

  // First, generate the AI summary
  try {
    modalContentElement.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="background: #2a2a2a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="color: #8b5cf6; font-size: 16px; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              <path d="M5 3v4"/>
              <path d="M19 17v4"/>
              <path d="M3 5h4"/>
              <path d="M17 19h4"/>
            </svg>
            Activity Summary
          </h3>
          <div style="color: #ddd; font-size: 14px; line-height: 1.8;">
            Generating summary...
          </div>
        </div>
        <h3 style="color: #ddd; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Recent Posts</h3>
      </div>
    `;

    // Add the raw posts
    modalContentElement.innerHTML += posts
      .map(
        (post) => `
      <div style="border: 1px solid #333; border-radius: 8px; padding: 12px; margin-bottom: 12px; background-color: #282828;">
        <div style="font-weight: bold; margin-bottom: 4px; color: #eee;">
          ${post.username} <span style="color: #888; font-weight: normal;">${post.handle}</span>
        </div>
        <p style="margin: 0; color: #ddd; white-space: pre-wrap;">${post.content}</p>
        ${post.images ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px;">
            ${post.images.map(img => `
              <img src="${img}" alt="Post image" style="width: 100%; border-radius: 4px; object-fit: cover;" />
            `).join('')}
          </div>
        ` : ''}
      </div>
    `
      )
      .join("");

    // Convert posts to the format expected by summarizeUsers
    const arenaUsers = posts.map(post => ({
      username: post.handle.replace('@', ''),
      exists: true,
      followerCount: 0,
      twitterHandle: post.handle,
      twitterName: post.username,
      twitterPicture: '',
      handle: post.handle,
      recentPosts: [{
        content: post.content,
        timestamp: new Date().toISOString(),
        images: post.images
      }]
    }));

    // Get the summary from the AI
    const summary = await summarizeUsers(arenaUsers);
    const summaryHtml = summary.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #8b5cf6">$1</strong>')
                              .replace(/\n/g, '<br>');

    // Update just the summary section
    const summaryElement = modalContentElement.querySelector('div[style*="color: #ddd; font-size: 14px"]');
    if (summaryElement) {
      summaryElement.innerHTML = summaryHtml;
    }
  } catch (error) {
    console.error('Error generating summary:', error);
    const summaryElement = modalContentElement.querySelector('div[style*="color: #ddd; font-size: 14px"]');
    if (summaryElement) {
      summaryElement.innerHTML = 'Error generating summary. Please try again later.';
    }
  }
}

function createModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "digest-modal-overlay";
  modalOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 2147483647;
    display: flex; justify-content: center; align-items: center;
  `;

  const modalContainer = document.createElement("div");
  modalContainer.style.cssText = `
    background: #1a1a1a; color: white; padding: 24px; border-radius: 12px;
    width: 90%; max-width: 600px; max-height: 80vh;
    display: flex; flex-direction: column;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  `;

  const modalHeader = document.createElement("div");
  modalHeader.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px;
  `;

  const modalTitle = document.createElement("h2");
  modalTitle.textContent = "Post Digest";
  modalTitle.style.cssText = "font-size: 20px; font-weight: 600;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✕";
  closeButton.style.cssText = `
    background: transparent; border: none; color: #aaa;
    font-size: 24px; cursor: pointer; line-height: 1;
    transition: color 0.2s;
  `;
  closeButton.onmouseover = () => (closeButton.style.color = "white");
  closeButton.onmouseout = () => (closeButton.style.color = "#aaa");

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeButton);

  const modalContent = document.createElement("div");
  modalContent.id = "digest-modal-content";
  modalContent.style.cssText = `
    overflow-y: auto;
    padding-right: 15px;
    margin-right: -15px;
  `;
  modalContent.innerHTML = "<p>Preparing to scan posts...</p>";

  modalContainer.appendChild(modalHeader);
  modalContainer.appendChild(modalContent);
  modalOverlay.appendChild(modalContainer);
  document.body.appendChild(modalOverlay);

  const closeModal = () => {
    modalOverlay.remove();
  };

  closeButton.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  extractPosts((message) => {
    modalContent.innerHTML = `<p>${message}</p>`;
  }).then((posts) => {
    renderPostsInModal(posts, modalContent);
  });
}

function injectDigestButton() {
  // Check if we're enabled and on the home route
  if (!isDigestEnabled || window.location.pathname !== '/home') return;

  const navParent = document.querySelector(
    "header.relative nav > div.fixed > div.flex-col"
  );
  if (!navParent) return;

  const navContainerEl = navParent as HTMLElement;
  navContainerEl.style.overflowY = "auto";
  navContainerEl.style.height = "100vh"; // Ensure it takes full viewport height

  if (document.querySelector(".digest-button")) return;

  const digestButtonContainer = document.createElement("div");
  digestButtonContainer.className = "py-1.5 text-gray-text opacity-100";

  const digestButton = document.createElement("button");
  digestButton.className = "group w-full digest-button";
  digestButton.innerHTML = `
    <div class="flex items-center justify-center gap-3 rounded-lg p-[10px] transition-colors group-hover:bg-gray-bg xl:justify-start">
      <div class="relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/>
          <path d="M19 17v4"/>
          <path d="M3 5h4"/>
          <path d="M17 19h4"/>
        </svg>
      </div>
      <span class="hidden text-base font-semibold leading-5 xl:inline">Digest</span>
    </div>
  `;

  digestButton.addEventListener("click", (e) => {
    e.preventDefault();
    createModal();
  });

  digestButtonContainer.appendChild(digestButton);

  const moreButton = document.querySelector('button[id^="radix-"]');
  if (moreButton && moreButton.parentElement) {
    moreButton.parentElement.insertBefore(digestButtonContainer, moreButton);
  } else {
    navParent.appendChild(digestButtonContainer);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      injectDigestButton();
    }
  }
});

export function initDigestButton(initial: boolean) {
  isDigestEnabled = initial;
  observer.observe(document.body, { childList: true, subtree: true });
  injectDigestButton();
}

export function setDigestEnabled(enabled: boolean) {
  isDigestEnabled = enabled;
  const navParent = document.querySelector(
    "header.relative nav > div.fixed > div.flex-col"
  );
  const navContainerEl = navParent as HTMLElement | null;

  if (!isDigestEnabled) {
    const existingButton = document.querySelector(".digest-button");
    existingButton?.parentElement?.remove();
    if (navContainerEl) {
      navContainerEl.style.overflowY = "";
      navContainerEl.style.height = "";
    }
  } else {
    injectDigestButton();
  }
}

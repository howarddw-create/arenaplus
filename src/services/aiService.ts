import { GoogleGenerativeAI } from "@google/generative-ai";

async function getGeminiApiKey(): Promise<string> {
  const data = await chrome.storage.local.get("features");
  const features = data.features || { geminiApiKey: "" };
  if (!features.geminiApiKey) {
    throw new Error(
      "Please configure your Gemini API key in the extension settings"
    );
  }
  return features.geminiApiKey;
}

const logService = (message: string, ...args: any[]) => {
  console.log(`[AI Service] ${message}`, ...args);
};

async function fileToGenerativePart(imageUrl: string): Promise<{
  inlineData: {
    data: string;
    mimeType: string;
  };
}> {
  try {
    logService("🔄 Processing image:", imageUrl);

    const cleanImageUrl = imageUrl.replace(
      "https://cors-anywhere.herokuapp.com/",
      ""
    );
    const response = await fetch(cleanImageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      throw new Error("Invalid image type");
    }

    if (blob.size > 4 * 1024 * 1024) {
      throw new Error("Image too large (max 4MB)");
    }

    const mimeType = blob.type || "image/jpeg";

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64Data = reader.result.split(",")[1];
          if (!base64Data) {
            reject(new Error("Failed to extract base64 data"));
            return;
          }
          resolve({
            inlineData: {
              data: base64Data,
              mimeType,
            },
          });
        } else {
          reject(new Error("Failed to convert image to base64"));
        }
      };

      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logService("❌ Error processing image:", error);
    throw error;
  }
}

export const generateReply = async (
  context: string,
  imageUrl?: string
): Promise<string> => {
  try {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        "Please configure your Gemini API key in the extension settings"
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt;
    let result;

    if (imageUrl?.trim()) {
      try {
        const imagePart = await fileToGenerativePart(imageUrl);
        prompt = [
          `Given this post with text: "${context}" and the attached image, generate a single friendly and relevant reply sentence. Consider both the text and image content in your response. Keep it casual and engaging.`,
          imagePart,
        ];
        result = await model.generateContent(prompt);
      } catch (imageError) {
        logService("⚠️ Image processing failed, using text-only response");
        prompt = `Given this post: "${context}", generate a single friendly and relevant reply sentence. Keep it casual and engaging.`;
        result = await model.generateContent(prompt);
      }
    } else {
      prompt = `Given this post: "${context}", generate a single friendly and relevant reply sentence. Keep it casual and engaging.`;
      result = await model.generateContent(prompt);
    }

    if (!result.response) {
      throw new Error("No response received from Gemini API");
    }

    return result.response.text();
  } catch (error: any) {
    const errorMessage = error.message || "Failed to generate reply";
    logService("❌ Error:", errorMessage);
    return `Error: ${errorMessage}`;
  }
};

export const summarizeUsers = async (
  users: any[]
): Promise<string> => {
  try {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Please configure your Gemini API key in the extension settings");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Process users in batches of 10
    const BATCH_SIZE = 10;
    let allSummaries = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const userBatch = users.slice(i, i + BATCH_SIZE);

      // Create a detailed list of users with their posts and process images for this batch
      const userList = await Promise.all(userBatch.map(async (user) => {
        const postInfo = user.recentPosts?.[0];
        let imagesPart = [];

        if (postInfo?.images?.length) {
          try {
            imagesPart = await Promise.all(
              postInfo.images.map(async (imgUrl: string) => await fileToGenerativePart(imgUrl))
            );
          } catch (error) {
            console.error('Error processing images:', error);
          }
        }

        return {
          text: `- @${user.username} (Followers: ${user.followerCount ?? "N/A"})${postInfo ? `\n    Recent post: "${postInfo.content}"` : ''
            }`,
          images: imagesPart,
          username: user.username // Store username for later use
        };
      }));

      // Combine all text and images for the batch prompt
      const prompt = [
        `As a crypto analyst, analyze these Arena Plus users, their recent posts, and any attached images.
        Create a clear, action-oriented summary of what each user is doing.

        Here are the users, their recent posts, and any attached media:
        ${userList.map(item => item.text).join('\n')}

        Create a summary that:
        1. For each user with meaningful content, create a line that follows this format:
           "**@username** is [action verb] [what they're doing]"
           
           Example formats:
           - **@user1** is announcing a new NFT collection
           - **@user2** is developing a DeFi protocol
           - **@user3** is collaborating on a cross-chain bridge
           
        2. Group similar activities together
        3. Only include users who have clear, meaningful actions or announcements
        4. Use present continuous tense (is doing, is building, is announcing)
        5. Keep each user's summary to a single line
        6. Add a line break between different types of activities
        7. If a user's post doesn't indicate a clear action, skip them
        8. If there are images, incorporate what they show into the summary

        Focus on concrete actions and announcements. Avoid vague or speculative statements.
        The final output should read like a clear status update of who is doing what in the ecosystem.`,
        ...userList.flatMap(item => item.images)
      ];

      const result = await model.generateContent(prompt);

      if (!result.response) {
        throw new Error("No response received from Gemini API");
      }

      // Get the summary text and convert usernames to clickable links
      let summaryText = result.response.text();

      // Replace all **@username** occurrences with clickable links
      userList.forEach(item => {
        const usernamePattern = new RegExp(`\\*\\*@${item.username}\\*\\*`, 'g');
        summaryText = summaryText.replace(
          usernamePattern,
          `<a href="https://arena.social/${item.username}" target="_blank" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">**@${item.username}**</a>`
        );
      });

      allSummaries.push(summaryText);
    }

    // Combine all batch summaries
    return allSummaries.join('\n\n');
  } catch (error: any) {
    const errorMessage = error.message || "Failed to generate summary";
    logService("❌ Error:", errorMessage);
    return `Error: ${errorMessage}`;
  }
};

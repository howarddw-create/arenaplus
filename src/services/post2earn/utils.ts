export class Post2EarnUtils {
    // Utility functions
    static formatTokenAmount(amount: string, decimals: number = 18): string {
        const num = parseFloat(amount) / Math.pow(10, decimals);
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    }

    static getPromotionTypeLabel(type: number): string {
        switch (type) {
            case 0: return 'Comment';
            case 1: return 'Repost';
            case 2: return 'Quote';
            default: return 'Unknown';
        }
    }

    static isPromotionExpired(expiresOn: number): boolean {
        return Date.now() / 1000 > expiresOn;
    }

    static getTimeRemaining(expiresOn: number): string {
        const now = Date.now() / 1000;
        const remaining = expiresOn - now;

        if (remaining <= 0) return 'Expired';

        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    static parseRichTextContent(htmlContent: string, maxWords: number = 15): { content: string; isHTML: boolean } {
        if (!htmlContent) return { content: '', isHTML: false };

        // Check if content contains HTML tags
        const hasHTML = /<[^>]*>/g.test(htmlContent);

        if (!hasHTML) {
            // Plain text - just truncate words
            const words = htmlContent.split(' ');
            const truncated = words.slice(0, maxWords).join(' ');
            return {
                content: truncated + (words.length > maxWords ? '...' : ''),
                isHTML: false
            };
        }

        // Parse HTML content while preserving @mentions with styling
        let parsedContent = htmlContent
            // Convert <p> tags to line breaks
            .replace(/<\/p><p>/g, '\n\n')
            .replace(/<p[^>]*>/g, '')
            .replace(/<\/p>/g, '\n')
            // Convert <br> tags to line breaks
            .replace(/<br\s*\/?>/gi, '\n')
            // Handle @mentions - keep them styled with proper spacing
            .replace(/<a[^>]*class="thread-tag"[^>]*data-user-handle="([^"]*)"[^>]*>[^<]*<\/a>/g, ' <span class="text-blue-500 font-medium">@$1</span> ')
            // Handle other links
            .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, ' <span class="text-blue-500">$2</span> ')
            // Clean up multiple line breaks
            .replace(/\n\s*\n/g, '\n')
            .trim();

        // Simple word-based truncation that preserves complete HTML tags
        const words = [];
        let currentWord = '';
        let insideTag = false;

        for (let i = 0; i < parsedContent.length; i++) {
            const char = parsedContent[i];

            if (char === '<') {
                if (currentWord.trim()) {
                    words.push(currentWord.trim());
                    currentWord = '';
                }
                insideTag = true;
                currentWord += char;
            } else if (char === '>') {
                currentWord += char;
                if (insideTag) {
                    words.push(currentWord);
                    currentWord = '';
                    insideTag = false;
                }
            } else if (char === ' ' && !insideTag) {
                if (currentWord.trim()) {
                    words.push(currentWord.trim());
                    currentWord = '';
                }
            } else {
                currentWord += char;
            }
        }

        if (currentWord.trim()) {
            words.push(currentWord.trim());
        }

        // Count only text words (not HTML tags)
        const textWords = words.filter(word => !word.startsWith('<'));

        if (textWords.length <= maxWords) {
            return {
                content: parsedContent,
                isHTML: true
            };
        }

        // Truncate while preserving HTML structure
        let textWordCount = 0;
        let result = [];

        for (const word of words) {
            if (word.startsWith('<')) {
                result.push(word);
            } else {
                if (textWordCount < maxWords) {
                    result.push(word);
                    textWordCount++;
                } else {
                    break;
                }
            }
        }

        return {
            content: result.join(' ') + (textWordCount >= maxWords ? '...' : ''),
            isHTML: true
        };
    }

    static async fetchTextViaBackground(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error: any) {
            throw new Error(error?.message || 'Failed to fetch text');
        }
    }

    static async fetchTextFromUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error: any) {
            throw new Error(error?.message || 'Failed to fetch text');
        }
    }
}

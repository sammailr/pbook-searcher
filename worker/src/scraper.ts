import { config } from './config';
import { ScrapeResult } from './types';

/**
 * Call the Cloudflare Worker scraper API
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.scraper.timeout);

    const response = await fetch(config.scraper.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Cloudflare Worker response to our format
    const result: ScrapeResult = {
      success: data.success || false,
      url: data.url || url,
      finalUrl: data.finalUrl || data.url,
      text: data.text || '',
      length: data.length || 0,
      originalLength: data.originalLength || 0,
      headers: data.headers || {},
    };

    if (!result.success && data.error) {
      result.error = data.error;
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Scraped ${url} in ${duration}ms - ${result.length || 0} chars`
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown scraping error';

    console.error(`❌ Failed to scrape ${url} after ${duration}ms:`, errorMessage);

    return {
      success: false,
      url,
      error: errorMessage,
    };
  }
}

/**
 * Extract PitchBook ID from a URL
 * Example: https://my.pitchbook.com/profile/123456/company/profile -> 123456
 */
export function extractPitchBookId(url: string): string | null {
  try {
    const match = url.match(/\/profile\/([^\/]+)\//);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting PitchBook ID:', error);
    return null;
  }
}

/**
 * Transform source URL to target scraping URL
 * From: https://my.pitchbook.com/profile/{ID}/company/profile
 * To: https://pitchbook.com/profiles/company/{ID}#overview
 */
export function transformUrl(sourceUrl: string): string | null {
  const id = extractPitchBookId(sourceUrl);
  if (!id) {
    console.error('Could not extract ID from URL:', sourceUrl);
    return null;
  }

  return `https://pitchbook.com/profiles/company/${id}#overview`;
}

/**
 * Validate that a URL is a valid PitchBook URL
 */
export function isPitchBookUrl(url: string): boolean {
  try {
    return url.includes('pitchbook.com') && url.includes('/profile/');
  } catch (error) {
    return false;
  }
}

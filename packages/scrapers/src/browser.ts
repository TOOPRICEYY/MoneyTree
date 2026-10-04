import { chromium } from 'playwright-core';
import type { BrowserContext } from 'playwright-core';

export type BrowserOptions = {
  /** Persistent profile, so logins survive between runs. Keep it in data/. */
  profileDir: string;
};

/**
 * Opens the user's installed Chrome (not a bundled Chromium, which retailer
 * bot detection blocks) with a persistent profile. Scrapers run headed so
 * the user can log in or solve a challenge when a site asks.
 */
export async function withBrowser<T>(
  { profileDir }: BrowserOptions,
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: null,
  });
  try {
    return await fn(context);
  } finally {
    await context.close();
  }
}

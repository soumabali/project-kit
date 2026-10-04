import type { Page } from '@playwright/test';

/** The app's sign-in path. A signed-in screen that lands here means the saved session didn't apply. */
export const signInPath = '/login';
export const onSignIn = (url: URL) => url.pathname.startsWith(signInPath);

// One entry per screen in 06-technical-docs/design/screens.md. Keep the ids identical.
export type Screen = {
  id: string;
  path: string;
  /** Saved sign-in to use (see tests/auth.setup.ts); omit for public screens. */
  auth?: 'user' | 'admin';
  /** Selector that must be visible before a capture, such as the main heading. */
  ready?: string;
  /** Selectors for content that changes between runs (dates, avatars, counters); masked in snapshots. */
  mask?: string[];
  /**
   * States to capture besides the default one. Each function prepares the page before navigation,
   * usually by intercepting the app's API calls to force an empty list, an error, or a slow response.
   * Interception is for capturing states only; journey tests always use the real backend.
   */
  states?: Record<string, (page: Page) => Promise<void>>;
};

export const breakpoints = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

export const screens: Screen[] = [
  {
    id: 'home',
    path: '/',
    ready: 'main',
    states: {
      error: async (page) => {
        await page.route('**/api/**', (route) => route.fulfill({ status: 500, json: { message: 'Server error' } }));
      },
    },
  },
];

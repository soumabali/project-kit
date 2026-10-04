import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Fixtures = {
  /** axe scan preset to WCAG 2.x A and AA. Chain .include() or .exclude() per test when needed. */
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<Fixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']));
  },
});

export { expect };

/** Collects console errors and uncaught exceptions so a test can assert the page ran cleanly. */
export function trackPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // A missing favicon is the browser's request, not the app's error.
    if (msg.type() === 'error' && !/\/favicon\.ico(\?|$)/.test(msg.location().url)) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

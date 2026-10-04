import fs from 'node:fs';
import { test, expect } from './fixtures';
import { breakpoints, onSignIn, screens } from '../screens';

// Visual regression and accessibility for every designed screen, state, and breakpoint.
// Baselines are rendered in the official Playwright Docker image (npm run test:visual:update) so they match CI.
for (const screen of screens) {
  test.describe(`screen ${screen.id}`, () => {
    test.skip(!!screen.auth && !fs.existsSync(`.auth/${screen.auth}.json`), `Needs a signed-in ${screen.auth}: set E2E_${(screen.auth ?? '').toUpperCase()}_EMAIL and _PASSWORD`);
    test.use({ storageState: screen.auth ? `.auth/${screen.auth}.json` : { cookies: [], origins: [] } });

    const states: Record<string, (page: import('@playwright/test').Page) => Promise<void>> = {
      default: async () => {},
      ...screen.states,
    };

    for (const [state, prepare] of Object.entries(states)) {
      for (const bp of breakpoints) {
        test(`${state} at ${bp.name}`, { tag: '@visual' }, async ({ page, makeAxeBuilder }, testInfo) => {
          test.skip(testInfo.project.name !== 'chromium', 'Visual baselines are kept for the chromium project only');
          await page.setViewportSize({ width: bp.width, height: bp.height });
          await prepare(page);
          await page.goto(screen.path);
          if (screen.auth) await expect(page, 'Landed on sign-in: the saved session does not apply to BASE_URL').not.toHaveURL(onSignIn);
          if (screen.ready) await expect(page.locator(screen.ready).first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${screen.id}-${state}-${bp.name}.png`, {
            fullPage: true,
            mask: (screen.mask ?? []).map((selector) => page.locator(selector)),
          });
          const results = await makeAxeBuilder().analyze();
          expect(results.violations).toEqual([]);
        });
      }
    }
  });
}

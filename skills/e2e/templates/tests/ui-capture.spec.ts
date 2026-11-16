import { test, expect } from './fixtures';
import { breakpoints, onSignIn, screens } from '../screens';

// Captures plain screenshots for /project-kit:ui-verify to compare against the design references, and runs the
// axe scan on each captured state. Runs only when UI_VERIFY=1: `npm run capture`.
// Captures go to ui-verify/ (git-ignored), outside test-results/, which Playwright empties on every run.
test.skip(!process.env.UI_VERIFY, 'Set UI_VERIFY=1 to capture screens for /project-kit:ui-verify');

for (const screen of screens) {
  test.describe(`capture ${screen.id}`, () => {
    // Decided by the credentials, not by the saved session file: this line runs before the setup project writes it.
    const role = (screen.auth ?? '').toUpperCase();
    test.skip(!!screen.auth && !(process.env[`E2E_${role}_EMAIL`] && process.env[`E2E_${role}_PASSWORD`]), `Needs a signed-in ${screen.auth}: set E2E_${role}_EMAIL and _PASSWORD`);
    test.use({ storageState: screen.auth ? `.auth/${screen.auth}.json` : { cookies: [], origins: [] } });

    const states: Record<string, (page: import('@playwright/test').Page) => Promise<void>> = {
      default: async () => {},
      ...screen.states,
    };

    for (const [state, prepare] of Object.entries(states)) {
      for (const bp of breakpoints) {
        test(`${state} at ${bp.width}`, async ({ page, makeAxeBuilder }) => {
          await page.setViewportSize({ width: bp.width, height: bp.height });
          await prepare(page);
          await page.goto(screen.path);
          if (screen.auth) await expect(page, 'Landed on sign-in: the saved session does not apply to BASE_URL').not.toHaveURL(onSignIn);
          if (screen.ready) await expect(page.locator(screen.ready).first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: `ui-verify/${screen.id}-${state}-${bp.width}.png`,
            fullPage: true,
            animations: 'disabled',
          });
          const results = await makeAxeBuilder().analyze();
          expect(results.violations).toEqual([]);
        });
      }
    }
  });
}

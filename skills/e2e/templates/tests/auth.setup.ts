import { test as setup, expect } from '@playwright/test';
import { onSignIn, signInPath } from '../screens';

// Signs in once per role and saves the session for the other tests. Accounts exist only in test environments
// (created by the backend's test seeder); credentials come from env vars and CI secrets, never from the repo.
// Adjust the labels, button name, and signInPath (in screens.ts) to the app's sign-in screen.
const roles = [
  { name: 'user', email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD },
  { name: 'admin', email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
] as const;

for (const role of roles) {
  setup(`sign in as ${role.name}`, async ({ page }) => {
    setup.skip(!role.email || !role.password, `Set E2E_${role.name.toUpperCase()}_EMAIL and E2E_${role.name.toUpperCase()}_PASSWORD`);
    await page.goto(signInPath);
    await page.getByLabel(/email/i).fill(role.email ?? '');
    await page.getByLabel(/password/i).fill(role.password ?? '');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).not.toHaveURL(onSignIn);
    await page.context().storageState({ path: `.auth/${role.name}.json` });
  });
}

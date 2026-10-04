import { test, expect, trackPageErrors } from './fixtures';

// Replace with the product's critical user journeys: one spec per journey in the PRD, in tests/flows/.
// Each covers the happy path and the most likely failure, against the real backend.
test('home page loads cleanly and is accessible', async ({ page, makeAxeBuilder }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});

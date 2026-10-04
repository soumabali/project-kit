import { test, expect } from '@playwright/test';

// Black-box API checks against the running stack. Paths are examples; use the real routes from the OpenAPI spec.
const API = process.env.API_URL ?? '/api';

test.describe('API contract', () => {
  test('rejects requests without a token', async ({ request }) => {
    const res = await request.get(`${API}/me`);
    expect(res.status()).toBe(401);
  });

  test('never returns another user\'s resource', async ({ request }) => {
    test.skip(!process.env.E2E_USER_TOKEN || !process.env.E2E_OTHER_RESOURCE_ID, 'Needs a test token and a resource owned by another test user');
    const res = await request.get(`${API}/bookings/${process.env.E2E_OTHER_RESOURCE_ID}`, {
      headers: { Authorization: `Bearer ${process.env.E2E_USER_TOKEN}` },
    });
    expect([403, 404]).toContain(res.status());
  });

  test('validates input', async ({ request }) => {
    test.skip(!process.env.E2E_USER_TOKEN, 'Needs a test token');
    const res = await request.post(`${API}/bookings`, {
      headers: { Authorization: `Bearer ${process.env.E2E_USER_TOKEN}` },
      data: { starts_at: 'not-a-date' },
    });
    expect(res.status()).toBe(422);
    expect(JSON.stringify(await res.json())).not.toMatch(/stack|trace|exception/i);
  });
});

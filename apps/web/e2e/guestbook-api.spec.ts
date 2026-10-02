import { expect, test } from '@playwright/test';

test('routes validate before storage and fail closed without Turnstile', async ({ request }) => {
  const valid = await request.post('/api/guestbook', { data: { name: 'Sam', message: 'Hello', turnstileToken: 'test' } });
  expect(valid.status()).toBe(403);
  expect((await valid.json()).reason).toBe('human_check');

  const long = await request.post('/api/guestbook', { data: { name: 'Sam', message: 'a'.repeat(141), turnstileToken: 'test' } });
  expect(long.status()).toBe(422);
  expect((await long.json()).reason).toBe('too_long');

  const presence = await request.post('/api/presence', { data: { sid: 'nope', surface: 'web' } });
  expect(presence.status()).toBe(400);

  const deleted = await request.delete('/api/guestbook/x');
  expect(deleted.status()).toBe(404);
});

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const entries = [
  { id: 'a1B2c3D4e5F6', name: 'Ada', message: 'Lovely site', at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'a1B2c3D4e5F7', name: 'Grace', message: 'Great terminal', at: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: 'a1B2c3D4e5F8', name: 'Linus', message: 'Nice work', at: new Date(Date.now() - 5 * 86400000).toISOString() },
];
const signed = { id: 'b1B2c3D4e5F6', name: 'Tester', message: 'Hello', at: new Date().toISOString() };

async function mockLive(page: Page, signStatus = 201) {
  const posts: unknown[] = [];
  const heartbeats: unknown[] = [];
  await page.route('**/api/presence', async (route) => {
    if (route.request().method() === 'POST') heartbeats.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ total: 2, bySurface: { web: 2 }, at: new Date().toISOString() }) });
  });
  await page.route('**/api/guestbook', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ entries }) });
    posts.push(route.request().postDataJSON());
    await route.fulfill({ status: signStatus, contentType: 'application/json', body: JSON.stringify(signStatus === 201
      ? { ok: true, entry: signed }
      : { ok: false, reason: 'rate_limited', message: "You've already signed today — thanks! Try again tomorrow." }) });
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: `window.turnstile={render:(_,options)=>{setTimeout(()=>options.callback('test-token'),0);return 'widget'},remove:()=>{}};` }));
  return { posts, heartbeats };
}

async function run(page: Page, command: string) {
  const input = page.getByLabel('Terminal command input');
  await input.fill(command);
  await input.press('Enter');
}

test('who, guestbook, signing, and heartbeat work in the terminal', async ({ page }) => {
  const { posts, heartbeats } = await mockLive(page);
  await page.goto('/');
  await expect.poll(() => heartbeats.length).toBeGreaterThan(0);
  expect(heartbeats[0]).toMatchObject({ sid: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/), surface: 'web' });
  await run(page, 'who');
  await expect(page.getByRole('log')).toContainText('2 people exploring right now');
  await run(page, 'guestbook');
  await expect(page.getByRole('log')).toContainText('Lovely site');
  await run(page, 'sign "Hello" --name Tester');
  await expect(page.getByRole('log')).toContainText('Thanks for signing, Tester!');
  expect(posts).toContainEqual({ name: 'Tester', message: 'Hello', turnstileToken: 'test-token' });
});

test('refusal keeps the command in history and invalid input never posts', async ({ page }) => {
  const { posts } = await mockLive(page, 429);
  await page.goto('/');
  await run(page, 'sign "Hello" --name Tester');
  await expect(page.getByRole('log')).toContainText("You've already signed today");
  await page.getByLabel('Terminal command input').press('ArrowUp');
  await expect(page.getByLabel('Terminal command input')).toHaveValue('sign "Hello" --name Tester');
  await run(page, `sign "${'a'.repeat(141)}" --name Tester`);
  await expect(page.getByRole('log')).toContainText('message up to 140');
  expect(posts).toHaveLength(1);
});

test('GUI lists entries and signs with a live counter', async ({ page }) => {
  const { posts } = await mockLive(page);
  await page.goto('/gui#guestbook');
  await expect(page.locator('#guestbook')).toContainText('Lovely site');
  await page.getByLabel('Your name').fill('Tester');
  await page.getByLabel('Message').fill('Hello');
  await expect(page.locator('#guestbook')).toContainText('5 / 140');
  await page.getByRole('button', { name: 'Sign guestbook' }).click();
  await expect(page.locator('#guestbook')).toContainText('Thanks for signing, Tester!');
  expect(posts).toContainEqual({ name: 'Tester', message: 'Hello', turnstileToken: 'test-token' });
});

test('curl can read but cannot sign', async ({ request }) => {
  const headers = { 'user-agent': 'curl/8.0' };
  const who = await request.get('/who', { headers });
  expect(who.status()).toBe(200);
  expect(await who.text()).toMatch(/exploring right now|unavailable/);
  const guestbook = await request.get('/guestbook', { headers });
  expect(guestbook.status()).toBe(200);
  expect(await guestbook.text()).toMatch(/Guestbook|No entries yet|unavailable/);
  const response = await request.get('/sign', { headers });
  expect(await response.text()).toContain('interactive terminal');
});

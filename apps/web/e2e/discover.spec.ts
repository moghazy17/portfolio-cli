import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const input = (page: Page) => page.getByRole('textbox', { name: /Terminal command input/ });
const reduced = () => test.info().project.name.includes('reduced');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
});

async function stubChat(page: Page) {
  const requests: unknown[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    const parts = [
      { type: 'start' }, { type: 'start-step' },
      { type: 'text-start', id: 'answer' }, { type: 'text-delta', id: 'answer', delta: 'RAG project answer.' },
      { type: 'text-end', id: 'answer' }, { type: 'finish-step' }, { type: 'finish' },
    ];
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: [...parts.map((part) => `data: ${JSON.stringify(part)}\n\n`), 'data: [DONE]\n\n'].join('') });
  });
  return requests;
}

for (const width of [320, 1280]) {
  test(`suggestions submit commands at ${width}px`, async ({ page }) => {
    test.skip(reduced());
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/');
    const bar = page.getByRole('navigation', { name: 'Suggestions' });
    await expect(bar.getByRole('button', { name: 'projects' })).toBeVisible();
    await bar.getByRole('button', { name: 'projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('[role="log"]')).toContainText('projects');
    await expect(bar.getByRole('button', { name: 'projects' })).toHaveCount(0);
    await input(page).press('ArrowUp');
    await expect(input(page)).toHaveValue('projects');
    await input(page).fill('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await input(page).fill('skills');
    await input(page).press('Enter');
    await expect(page).toHaveURL(/\/skills$/);
    await expect(bar.getByRole('button', { name: 'skills' })).toHaveCount(0);
  });
}

test('question suggestion uses the assistant submission path', async ({ page }) => {
  test.skip(reduced());
  const requests = await stubChat(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Suggestions' }).getByRole('button', { name: /^Ask the assistant:/ }).click();
  await expect(page.locator('[role="log"]')).toContainText('RAG project answer.');
  expect(requests).toHaveLength(1);
  await expect(page).toHaveURL('/');
});

test('prompt example rotates, stays outside the input, and hides while typing', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const example = page.locator('.prompt-example');
  await expect(example).toBeVisible();
  const initial = await example.textContent();
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).not.toHaveAttribute('placeholder');
  await page.clock.fastForward(4_100);
  await expect(example).toHaveText(reduced() ? initial! : 'try: neofetch');
  await input(page).fill('about');
  await expect(example).toHaveCount(0);
});

test('tour stops on a key and restores the starting theme', async ({ page }) => {
  test.skip(reduced());
  await stubChat(page);
  await page.clock.install();
  await page.goto('/');
  await input(page).fill('theme dracula');
  await input(page).press('Enter');
  await expect(page.locator('.terminal-container')).not.toHaveAttribute('data-effect', 'crt');
  await input(page).fill('tour');
  await input(page).press('Enter');
  await expect(page.getByText('Starting the tour…')).toBeVisible();
  await page.keyboard.press('x');
  await expect(input(page)).toHaveValue('');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('terminal-theme'))).toBe('dracula');
  const count = await page.locator('[role="log"] > div').count();
  await page.clock.fastForward(60_000);
  expect(await page.locator('[role="log"] > div').count()).toBe(count);
});

test('tour completes and a deep link never starts playback', async ({ page }) => {
  test.skip(reduced());
  await stubChat(page);
  await page.clock.install();
  await page.goto('/tour');
  await expect(page.getByText('Starting the tour…')).toBeVisible();
  await page.clock.fastForward(2_000);
  await expect(page.locator('.tour-finish')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Suggestions' }).getByRole('button', { name: 'take the tour' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Suggestions' }).getByRole('button', { name: 'take the tour' }).click();
  for (let step = 0; step < 12 && await page.locator('.tour-finish').count() === 0; step++) {
    await page.clock.runFor(10_000);
  }
  await expect(page.getByText('Your turn')).toBeVisible();
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('.terminal-container')).not.toHaveAttribute('data-effect', 'crt');
});

test('tour waits for an assistant stream before starting the next step', async ({ page }) => {
  test.skip(reduced());
  let release: (() => void) | undefined;
  await page.route('**/api/chat', async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: 'data: {"type":"start"}\n\ndata: {"type":"text-start","id":"a"}\n\ndata: {"type":"text-delta","id":"a","delta":"Done."}\n\ndata: {"type":"text-end","id":"a"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n' });
  });
  await page.clock.install();
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  for (let step = 0; step < 8 && !release; step++) await page.clock.runFor(10_000);
  expect(release).toBeDefined();
  await page.clock.runFor(20_000);
  await expect(page.locator('[role="log"]')).not.toContainText('theme crt');
  release!();
  for (let step = 0; step < 8 && await page.locator('.tour-finish').count() === 0; step++) await page.clock.runFor(10_000);
  await expect(page.getByText('Your turn')).toBeVisible();
});

test('reduced-motion tour skips the CRT step', async ({ page }) => {
  test.skip(!reduced());
  await stubChat(page);
  await page.clock.install();
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  for (let step = 0; step < 10 && await page.locator('.tour-finish').count() === 0; step++) await page.clock.runFor(10_000);
  await expect(page.getByText('Your turn')).toBeVisible();
  await expect(page.locator('[role="log"]')).not.toContainText('theme crt');
});

test('shortcuts respect an empty prompt and pass axe', async ({ page }) => {
  await page.goto('/');
  await input(page).press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.command-bar').include('.command-input-wrap').include('.shortcut-sheet').analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await input(page).fill('What RAG work');
  await input(page).press('?');
  await expect(input(page)).toHaveValue('What RAG work?');
  await expect(dialog).toHaveCount(0);
});

test('touch load leaves the keyboard closed', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
  await page.goto('/');
  await expect(input(page)).not.toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('events endpoint rejects unknown kinds', async ({ request }) => {
  expect((await request.post('/api/events', { data: { kind: 'unknown' } })).status()).toBe(400);
});

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

test('guided tour navigates without rerunning steps or reacting to page clicks and scrolls', async ({ page }) => {
  test.skip(reduced());
  await stubChat(page);
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto('/');
  await input(page).fill('theme dracula');
  await input(page).press('Enter');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  const next = card.getByRole('button', { name: 'Next →' });
  await expect(card).toContainText('Step 1/5 · About');
  await expect(page.locator('[data-tour-step="0"]')).toContainText('About ');
  await expect(page.getByText('Theme switched to "dracula".')).toBeVisible();
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  const axe = await new AxeBuilder({ page }).include('.tour-card').analyze();
  expect(axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await next.click();
  await expect(card).toContainText('Step 2/5 · Skills');
  await expect(page.locator('[data-tour-step="1"]')).toContainText('Skills');
  const count = await page.locator('[data-tour-step]').count();
  await card.getByRole('button', { name: 'Back' }).click();
  await expect(card).toContainText('Step 1/5 · About');
  await expect(page.locator('[data-tour-step="0"]')).toBeInViewport();
  expect(await page.locator('[data-tour-step]').count()).toBe(count);
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Step 2/5 · Skills');
  expect(await page.locator('[data-tour-step]').count()).toBe(count);
  await next.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(card).toContainText('Step 1/5 · About');
  await next.focus();
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Step 2/5 · Skills');
  expect(await page.locator('[data-tour-step]').count()).toBe(count);
  await page.getByRole('log', { name: 'Terminal output' }).click({ position: { x: 4, y: 4 } });
  await page.mouse.wheel(0, 200);
  await expect(card).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await next.focus();
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Step 3/5 · Ask anything');
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(card).toContainText('Step 4/5 · Themes');
  await expect(page.locator('.terminal-container')).toHaveAttribute('data-effect', 'crt');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page.locator('.terminal-container')).not.toHaveAttribute('data-effect', 'crt');
  await expect(page.locator('.tour-finish')).toHaveCount(0);
  await expect(input(page)).toHaveValue('');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('terminal-theme'))).toBe('dracula');
});

test('typing a visitor command exits the guided tour quietly', async ({ page }) => {
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: /^Next/ })).toHaveAttribute('aria-disabled', 'false');
  await expect(input(page)).toHaveValue('');
  await input(page).fill('skills');
  await expect(card).toHaveCount(0);
  await expect(input(page)).toHaveValue('skills');
  await expect(page.locator('.tour-finish')).toHaveCount(0);
  await input(page).press('Enter');
  await expect(page.locator('[role="log"]')).toContainText('Skills');
});

test('Enter activates focused tour buttons and Exit returns focus to the prompt', async ({ page }) => {
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  const next = card.getByRole('button', { name: /^Next/ });
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(card).toContainText('Step 2/');
  const count = await page.locator('[data-tour-step]').count();
  const back = card.getByRole('button', { name: 'Back' });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Step 1/');
  expect(await page.locator('[data-tour-step]').count()).toBe(count);
  await next.focus();
  await page.keyboard.press('Tab');
  const exit = card.getByRole('button', { name: 'Exit' });
  await expect(exit).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await page.keyboard.type('skills');
  await expect(input(page)).toHaveValue('skills');
});

test('Back scrolls to the current tour session after a previous tour', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 420 });
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  const firstEntry = page.locator('[data-tour-step="0"]').first();
  await expect(firstEntry).toContainText('About ');
  const firstSession = (await firstEntry.getAttribute('data-tour'))!.split(':')[0];
  await card.getByRole('button', { name: 'Exit' }).click();
  await expect(card).toHaveCount(0);
  await expect(input(page)).toHaveValue('');
  await input(page).fill('tour');
  await input(page).press('Enter');
  await expect(page.locator('[data-tour-step="0"]')).toHaveCount(2);
  const secondEntry = page.locator('[data-tour-step="0"]').last();
  await expect(secondEntry).toContainText('About ');
  const secondSession = (await secondEntry.getAttribute('data-tour'))!.split(':')[0];
  expect(secondSession).not.toBe(firstSession);
  const next = card.getByRole('button', { name: /^Next/ });
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(card).toContainText('Step 2/');
  await card.getByRole('button', { name: 'Back' }).click();
  await expect(card).toContainText('Step 1/');
  await expect(page.locator(`[data-tour="${secondSession}:0"]`)).toBeInViewport();
  await expect(page.locator(`[data-tour="${firstSession}:0"]`)).not.toBeInViewport();
});

test('guided tour finishes and a deep link never starts it', async ({ page }) => {
  test.skip(reduced());
  await stubChat(page);
  await page.goto('/tour');
  await expect(page.getByText('Starting the tour…')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tour' })).toHaveCount(0);
  await expect(page.locator('.tour-finish')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Suggestions' }).getByRole('button', { name: 'take the tour' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Suggestions' }).getByRole('button', { name: 'take the tour' }).click();
  const card = page.getByRole('region', { name: 'Tour' });
  for (let step = 1; step < 5; step++) {
    const next = card.getByRole('button', { name: 'Next →' });
    await expect(next).toHaveAttribute('aria-disabled', 'false');
    await next.click();
    await expect(card).toContainText(`Step ${step + 1}/5`);
  }
  await expect(page.locator('[data-tour-step="3"]')).toContainText('theme crt');
  await expect(page.locator('.terminal-container')).toHaveAttribute('data-effect', 'crt');
  const finish = card.getByRole('button', { name: 'Finish' });
  await expect(finish).toHaveAttribute('aria-disabled', 'false');
  await finish.click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('Your turn')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Suggestions' })).toBeVisible();
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
  await expect(page.locator('.terminal-container')).not.toHaveAttribute('data-effect', 'crt');
});

test('guided tour disables Next until the assistant stream finishes', async ({ page }) => {
  test.skip(reduced());
  let release: (() => void) | undefined;
  await page.route('**/api/chat', async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: 'data: {"type":"start"}\n\ndata: {"type":"text-start","id":"a"}\n\ndata: {"type":"text-delta","id":"a","delta":"Done."}\n\ndata: {"type":"text-end","id":"a"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n' });
  });
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  const next = card.getByRole('button', { name: 'Next →' });
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(card).toContainText('Step 2/5 · Skills');
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await next.click();
  await expect(card).toContainText('Step 3/5 · Ask anything');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(input(page)).toHaveValue('What RAG work has he done?');
  const entriesBefore = await page.locator('[data-tour-step]').count();
  const addressBefore = page.url();
  await input(page).press('Enter');
  await expect(card).toContainText('Step 3/5');
  expect(await page.locator('[data-tour-step]').count()).toBe(entriesBefore);
  expect(page.url()).toBe(addressBefore);
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Step 3/5 · Ask anything');
  await expect(page.locator('[role="log"]')).not.toContainText('theme crt');
  release!();
  await expect(next).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('[data-tour-step="2"]')).toContainText('Done.');
  await next.click();
  await expect(card).toContainText('Step 4/5 · Themes');
});

test('reduced-motion tour skips the CRT step', async ({ page }) => {
  test.skip(!reduced());
  await stubChat(page);
  await page.goto('/');
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  await expect(card).toContainText('Step 1/4 · About');
  for (let step = 1; step < 4; step++) {
    const next = card.getByRole('button', { name: 'Next →' });
    await expect(next).toHaveAttribute('aria-disabled', 'false');
    await next.click();
    await expect(card).toContainText(`Step ${step + 1}/4`);
  }
  await expect(card).toContainText("Step 4/4 · Who's here");
  await expect(card.getByRole('button', { name: 'Finish' })).toHaveAttribute('aria-disabled', 'false');
  await card.getByRole('button', { name: 'Finish' }).click();
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
  await input(page).fill('tour');
  await input(page).press('Enter');
  const card = page.getByRole('region', { name: 'Tour' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Exit' }).click();
  await expect(card).toHaveCount(0);
  await expect(input(page)).not.toBeFocused();
  await context.close();
});

test('events endpoint rejects unknown kinds', async ({ request }) => {
  expect((await request.post('/api/events', { data: { kind: 'unknown' } })).status()).toBe(400);
});

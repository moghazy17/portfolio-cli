import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getMenuItems, themes } from '@ahmed-moghazy/shared';

const input = (page: Page) => page.getByRole('textbox', { name: /Terminal command input/ });
const bar = (page: Page) => page.getByRole('navigation', { name: 'Suggestions' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'All commands' });
const reduced = () => test.info().project.name.includes('reduced');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
});

test('shows one bottom bar with an always-last all commands button', async ({ page }) => {
  await page.goto('/');
  await expect(bar(page)).toHaveCount(1);
  await expect(bar(page).getByRole('button', { name: 'All commands' })).toBeVisible();
  await expect(page.locator('.menu-bar, .suggestion-bar, .shortcut-hint')).toHaveCount(0);
  expect(await bar(page).locator(':scope > .command-bar-items > button').last().getAttribute('aria-label')).toBe('All commands');
  const positions = await page.evaluate(() => {
    const prompt = document.querySelector('.command-input-wrap')!.getBoundingClientRect();
    const controls = document.querySelector('.command-bar')!.getBoundingClientRect();
    return { promptBottom: prompt.bottom, barTop: controls.top };
  });
  expect(positions.barTop).toBeGreaterThanOrEqual(positions.promptBottom);
  await page.setViewportSize({ width: 1280, height: 720 });
  const widths = await bar(page).locator('.command-bar-items').evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});


test('welcome uses the shared hint and adds the shortcut hint on fine pointers', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[role="log"]')).toContainText('Tap a suggestion, or just type a command or question. Press ? for shortcuts.');
  await expect(page.locator('[role="log"]')).not.toContainText('arrow keys');
});

test('every former menu command is reachable and runs from the sheet with a mouse', async ({ page }) => {
  for (const item of getMenuItems()) {
    // Opening `gui` remembers that view, which would send `/` back to the regular page.
    await page.context().clearCookies();
    await page.goto('/');
    await bar(page).getByRole('button', { name: 'All commands' }).click();
    await dialog(page).getByRole('button', { name: new RegExp(`^${item.value}\\b`) }).click();
    await expect(dialog(page)).toHaveCount(0);
    if (item.value === 'gui') await expect(page).toHaveURL(/\/gui$/);
    else await expect(page.locator('[role="log"]')).toContainText(item.value);
  }
});

test('keyboard enters the bar, roves, opens the sheet, and activates a command', async ({ page }) => {
  await page.goto('/');
  await input(page).focus();
  await input(page).press('Tab');
  const buttons = bar(page).locator('.command-bar-items > button');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(buttons.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialog(page).locator('.command-sheet-list button').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('[role="log"]')).toContainText('about');
});

test('dialog traps focus and returns it to the prompt after Escape and backdrop clicks', async ({ page }) => {
  await page.goto('/');
  await bar(page).getByRole('button', { name: 'All commands' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Close all commands' })).toBeFocused();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await bar(page).getByRole('button', { name: 'All commands' }).click();
  await expect(dialog(page).getByRole('button', { name: 'Close all commands' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog(page).locator('button').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', { name: 'Close all commands' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await bar(page).getByRole('button', { name: 'All commands' }).click();
  await page.locator('.command-sheet-backdrop').click({ position: { x: 2, y: 2 } });
  await expect(dialog(page)).toHaveCount(0);
  await expect(input(page)).toBeFocused();
});

test('assistant chip has its full accessible name and the empty prompt shows no ghost text', async ({ page }) => {
  await page.goto('/');
  await expect(bar(page).getByRole('button', { name: /^Ask the assistant: / })).toBeVisible();
  await expect(page.locator('.prompt-example')).toHaveCount(0);
});

test('320px viewport contains both bar and sheet without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await bar(page).getByRole('button', { name: 'All commands' }).click();
  await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('touch bar stays above the keyboard inset and sheet items work by tap', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 640 }, reducedMotion: reduced() ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
  await page.goto('/');
  await expect(page.locator('[role="log"]')).toContainText('Tap a suggestion, or just type a command or question.');
  await expect(page.locator('[role="log"]')).not.toContainText('Press ? for shortcuts.');
  await page.evaluate(() => document.documentElement.style.setProperty('--keyboard-inset', '220px'));
  const bottom = await bar(page).evaluate((node) => node.getBoundingClientRect().bottom);
  expect(bottom).toBeLessThanOrEqual(640 - 220);
  await bar(page).getByRole('button', { name: 'All commands' }).tap();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: /^about\b/ }).tap();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('[role="log"]')).toContainText('about');
  await context.close();
});

test('bar and sheet have no serious or critical axe violations in every theme', async ({ page }) => {
  await page.goto('/');
  for (const name of Object.keys(themes)) {
    await input(page).fill(`theme ${name}`);
    await input(page).press('Enter');
    await expect(bar(page).getByRole('button', { name: 'All commands' })).toBeVisible();
    const barResults = await new AxeBuilder({ page }).include('.command-bar').analyze();
    expect(barResults.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')), `${name} bar`).toEqual([]);
    await bar(page).getByRole('button', { name: 'All commands' }).click();
    const sheetResults = await new AxeBuilder({ page }).include('.command-sheet').analyze();
    expect(sheetResults.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')), `${name} sheet`).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

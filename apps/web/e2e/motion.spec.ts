import { expect, test } from '@playwright/test';

const input = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: /Terminal command input/ });

test.describe('terminal motion', () => {
  test('boot accepts typing, stays dismissed, and never runs on a deep link', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium' || test.info().project.name.includes('reduced'));
    await page.goto('/');
    await expect(page.getByTestId('boot')).toBeVisible();
    await page.keyboard.type('about');
    await expect(page.getByTestId('boot')).toBeHidden();
    await expect(input(page)).toHaveValue('about');
    await page.reload();
    await expect(page.getByTestId('boot')).toHaveCount(0);
    const other = await page.context().browser()!.newContext();
    const deep = await other.newPage();
    await deep.goto('/projects');
    await expect(deep.getByTestId('boot')).toHaveCount(0);
    await other.close();
  });

  test('types short output once and completes on keypress; long output is instant', async ({ page }) => {
    test.skip(test.info().project.name.includes('reduced'));
    await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
    await page.goto('/');
    await input(page).fill('about');
    await input(page).press('Enter');
    await expect(page.locator('[data-reveal="typing"]')).toBeVisible();
    await expect(page.locator('[role="log"] .sr-only')).toHaveCount(1);
    await expect(page.locator('[data-reveal="typing"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-reveal="typing"]')).toHaveCount(0, { timeout: 1600 });
    await input(page).fill('whoami');
    await input(page).press('Enter');
    await expect(page.locator('[data-reveal="typing"]')).toBeVisible();
    await page.keyboard.press('x');
    await expect(page.locator('[data-reveal="typing"]')).toHaveCount(0);
    await expect(page.locator('[role="log"] .sr-only')).toHaveCount(0);
    await input(page).fill(Array(41).fill('whoami').join('; '));
    await input(page).press('Enter');
    await expect(page.locator('[data-reveal="typing"]')).toHaveCount(0);
  });

  test('glitch skips, CRT persists, and skill bars show evidence', async ({ page }) => {
    test.skip(test.info().project.name.includes('reduced'));
    await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
    await page.route('**/api/skills', async (route) => route.fulfill({ json: { evidence: { Python: 4 }, generatedAt: new Date().toISOString() } }));
    await page.goto('/');
    await expect(page.locator('.ascii-banner.glitch-reveal')).toBeVisible();
    await page.keyboard.press('x');
    await expect(page.locator('.ascii-banner.glitch-reveal')).toHaveCount(0);
    await input(page).fill('theme crt');
    await input(page).press('Enter');
    await expect(page.locator('[data-effect="crt"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-effect="crt"]')).toBeVisible();
    await input(page).fill('skills');
    await input(page).press('Enter');
    await expect(page.locator('[role="progressbar"][aria-valuetext]').first()).toBeVisible();
  });

  test('screensaver dismisses with typing and Enter only dismisses', async ({ page }) => {
    test.skip(test.info().project.name.includes('reduced'));
    await page.addInitScript(() => localStorage.setItem('boot:v1', '1'));
    await page.clock.install();
    await page.goto('/');
    await expect(input(page)).toBeFocused();
    await page.waitForTimeout(100);
    await page.clock.fastForward(60_100);
    await expect(page.getByTestId('screensaver')).toBeVisible();
    await page.keyboard.press('a');
    await expect(page.getByTestId('screensaver')).toHaveCount(0);
    await expect(input(page)).toHaveValue('a');
    await page.clock.fastForward(60_100);
    await expect(page.getByTestId('screensaver')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('screensaver')).toHaveCount(0);
    await expect(input(page)).toHaveValue('a');
  });

  test('reduced motion leaves all output static', async ({ page }) => {
    test.skip(!test.info().project.name.includes('reduced'));
    await page.goto('/');
    await expect(page.getByTestId('boot')).toHaveCount(0);
    await expect(page.locator('.ascii-banner.glitch-reveal')).toHaveCount(0);
    await input(page).fill('about');
    await input(page).press('Enter');
    await expect(page.locator('[data-reveal="typing"]')).toHaveCount(0);
    await page.clock.install();
    await page.clock.fastForward(60_100);
    await expect(page.getByTestId('screensaver')).toHaveCount(0);
  });
});

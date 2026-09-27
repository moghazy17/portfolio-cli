import { expect, test } from '@playwright/test';
import { content, cvData, itemIds, themes } from '@ahmed-moghazy/shared';

test.describe('US1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('completes a command and lists ambiguous candidates', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('pro');
    await input.press('Tab');
    await expect(input).toHaveValue('projects ');

    await input.fill('t');
    await input.press('Tab');
    await input.press('Tab');
    await expect(input).toHaveValue('t');
    for (const candidate of ['theme', 'timeline']) {
      await expect(page.getByText(candidate, { exact: true }).first()).toBeVisible();
    }
  });

  test('browses command history and restores a draft', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    for (const command of ['about', 'skills', 'help']) {
      await input.fill(command);
      await input.press('Enter');
      await expect(input).toHaveValue('');
    }
    await input.press('ArrowUp');
    await input.press('ArrowUp');
    await input.press('ArrowUp');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('skills');
    await input.fill('abc');
    await input.press('ArrowUp');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('abc');
  });

  test('persists command history after reload', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('about');
    await input.press('Enter');
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await page.reload();
    const reloadedInput = page.getByLabel('Terminal command input');
    await reloadedInput.press('ArrowUp');
    await expect(reloadedInput).toHaveValue('about');
  });

  test('echoes Ctrl+C and clears the line', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('foo');
    await input.press('Control+c');
    await expect(page.getByText('foo^C', { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('keeps the line when Ctrl+C copies selected output', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('about');
    await input.press('Enter');
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await input.fill('foo');
    await page.evaluate((heading) => {
      const node = [...document.querySelectorAll('div')].find((item) => item.textContent === heading);
      if (!node) throw new Error('Output heading was not found');
      const range = document.createRange();
      range.selectNodeContents(node);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }, `About ${cvData.name}`);
    await input.press('Control+c');
    await expect(input).toHaveValue('foo');
    await expect(page.getByText('foo^C', { exact: true })).toHaveCount(0);
  });

  test('Ctrl+L clears output and keeps the current line', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('about');
    await input.press('Enter');
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await input.fill('abc');
    await input.press('Control+l');
    await expect(page.getByText(`About ${cvData.name}`)).toHaveCount(0);
    await expect(input).toHaveValue('abc');
  });

  test('renders filtered project lines and command suggestions', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    const project = cvData.projects[0];
    const word = project.name.split(/\s+/)[0];
    await input.fill(`projects | grep ${word}`);
    await input.press('Enter');
    const projectId = itemIds(content).project[0];
    await expect(page.getByText(new RegExp(`${projectId}: .*${word}`, 'i')).first()).toBeVisible();

    await input.fill('projcts');
    await input.press('Enter');
    await expect(page.getByText('did you mean `projects`?')).toBeVisible();
  });

  test('applies the theme and runs menu commands', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('theme dracula');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(themes.dracula.background);
    await page.getByRole('button', { name: 'about', exact: true }).click();
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('about');
  });

  test('Ctrl+C exits idle chat', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('chat');
    await input.press('Enter');
    const chatInput = page.getByLabel('Chat input');
    await expect(chatInput).toBeVisible();
    await chatInput.press('Control+c');
    await expect(input).toBeVisible();
  });

  test('updates completion and history within the interaction budget', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('about');
    await input.press('Enter');
    await expect(input).toHaveValue('');

    async function measureKey(key: string, before: string, after: string) {
      await input.fill(before);
      return input.evaluate(async (element, args) => {
        const field = element as HTMLInputElement;
        const started = performance.now();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: args.key, bubbles: true, cancelable: true }));
        while (field.value !== args.after && performance.now() - started < 1000) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        return { elapsed: performance.now() - started, value: field.value };
      }, { key, after });
    }

    const tab = await measureKey('Tab', 'pro', 'projects ');
    expect(tab.value).toBe('projects ');
    expect(tab.elapsed, `Tab completion took ${tab.elapsed.toFixed(1)} ms`).toBeLessThan(100);
    const up = await measureKey('ArrowUp', '', 'about');
    expect(up.value).toBe('about');
    expect(up.elapsed, `ArrowUp history took ${up.elapsed.toFixed(1)} ms`).toBeLessThan(100);
    console.log(`SC-004 Tab ${tab.elapsed.toFixed(1)} ms; ArrowUp ${up.elapsed.toFixed(1)} ms`);
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createShell, cvData, WELCOME_SUBTITLE } from '@ahmed-moghazy/shared';

const sections = ['hero', 'about', 'experience', 'projects', 'skills', 'contact'];

async function runCommand(page: Page, command: string) {
  const input = page.getByLabel('Terminal command input');
  await input.fill(command);
  await input.press('Enter');
}

async function viewCookie(page: Page): Promise<string | undefined> {
  return (await page.context().cookies()).find((cookie) => cookie.name === 'view')?.value;
}

// Scroll through the page so every section has revealed, then back to the top.
async function revealAll(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    window.scrollTo(0, 0);
  });
}

test.describe('Regular page', () => {
  test('desktop starts with one centred terminal and no page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    await expect(page.locator('.be-win:visible')).toHaveCount(1);
    await expect(page.locator('#terminal')).toBeVisible();
    await expect(page.getByRole('log', { name: 'Terminal output' })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      terminal: document.getElementById('terminal')!.getBoundingClientRect().toJSON(),
    }));
    expect(metrics.scrollHeight).toBe(metrics.clientHeight);
    expect(metrics.terminal.left).toBeGreaterThan(240);
    expect(metrics.terminal.right).toBeLessThan(1440);
    await expect(page.locator('.be-docked-tab')).toBeHidden();
  });

  test('desktop icons and Deskbar manage window state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    await page.getByRole('list', { name: 'Desktop' }).getByRole('button', { name: 'Projects' }).click();
    const projects = page.locator('#projects');
    const entry = page.locator('[data-window-entry="projects"]');
    await expect(projects).toBeVisible();
    await expect(projects).toHaveClass(/is-active/);
    await expect(entry).toHaveAttribute('aria-pressed', 'true');
    await entry.click();
    await expect(projects).toBeHidden();
    await expect(entry).toContainText('(minimized)');
    await entry.click();
    await expect(projects).toBeVisible();
    await projects.locator('.be-tab').dblclick();
    await expect(projects).toBeHidden();
    await entry.click();
    await projects.getByRole('button', { name: 'Minimize Projects' }).click();
    await expect(projects).toBeHidden();
    await entry.click();
    await projects.getByRole('button', { name: 'Maximize Projects' }).click();
    await expect(projects).toHaveClass(/is-maximized/);
    await expect(projects.getByRole('button', { name: 'Restore Projects' })).toHaveAttribute('aria-pressed', 'true');
    await projects.getByRole('button', { name: 'Restore Projects' }).click();
    await expect(projects).not.toHaveClass(/is-maximized/);
  });

  test('hash links open a window, while a plain reload starts fresh', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui#projects');
    await expect(page.locator('#projects')).toBeVisible();
    await expect(page.locator('#projects')).toHaveClass(/is-active/);
    await page.goto('/gui');
    await page.reload();
    await expect(page.locator('.be-win:visible')).toHaveCount(1);
    await expect(page.locator('#terminal')).toBeVisible();
  });

  test('windowed terminal chips run in place and theme the window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    await page.locator('#terminal .be-chip[data-line="projects"]').click();
    await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('projects');
    await expect(page).toHaveURL(/\/gui$/);
    const before = await page.locator('#terminal .be-term').evaluate((node) => getComputedStyle(node).backgroundColor);
    const input = page.locator('#terminal').getByLabel('Terminal command input');
    await input.fill('theme dracula');
    await input.press('Enter');
    await expect.poll(() => page.locator('#terminal .be-term').evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(before);
    await expect(page).toHaveURL(/\/gui$/);
  });

  test('every opened window fits a 1366 by 768 desk', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/gui');
    for (const id of ['hero', 'about', 'projects', 'experience', 'skills', 'films', 'guestbook', 'contact']) {
      await page.locator(`[data-window-entry="${id}"]`).click();
    }
    for (const window of await page.locator('.be-win:visible').all()) {
      const box = await window.boundingBox();
      expect(box, (await window.getAttribute('id')) ?? undefined).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
      expect(box!.y + box!.height).toBeLessThanOrEqual(768);
    }
  });

  test('phone keeps the complete scrolling stack without desktop boxes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/gui');
    await expect(page.locator('.be-win:visible')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(844);
    await expect(page.locator('.be-box-close:visible, .be-box-zoom:visible, .be-box-collapse, .is-collapsed')).toHaveCount(0);
    await expect(page.locator('#terminal')).toBeVisible();
  });

  test('shows the switch button without scrolling on phones and desktops', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 640 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByTestId('open-gui')).toBeInViewport({ ratio: 1 });
    }
  });

  test('opens from the button with the same content as the terminal', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-gui').click();
    await expect(page).toHaveURL(/\/gui$/);

    for (const id of sections) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.locator('header#hero h1')).toHaveText(cvData.name);
    for (const id of sections.slice(1)) await expect(page.locator(`section#${id} h2`)).toBeAttached();
    for (const experience of cvData.experience) {
      await expect(page.locator('#experience').getByText(experience.company, { exact: true }).first()).toBeAttached();
    }
    for (const project of cvData.projects) {
      await expect(page.locator('#projects h3').filter({ hasText: project.name })).toBeAttached();
    }
    await expect(page.locator('#contact').getByText(cvData.contact.email)).toBeAttached();
    for (const category of cvData.skills) {
      await expect(page.locator('#skills h3').filter({ hasText: category.name })).toBeAttached();
    }
  });

  test('downloads the same CV as the resume command', async ({ page }) => {
    const { download } = await createShell({ surface: 'web', origin: '' }).run('resume');
    expect(download).toBeDefined();
    await page.goto('/gui');
    const cv = page.getByTestId('gui-cv');
    await expect(cv).toHaveAttribute('href', download!.url);
    await expect(cv).toHaveAttribute('download', download!.filename);
    await expect(page.getByTestId('gui-cv-contact')).toHaveAttribute('href', download!.url);
    const response = await page.request.get(download!.url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('pdf');
  });

  test('returns to the terminal with the earlier output and no welcome replay', async ({ page }) => {
    await page.goto('/');
    await runCommand(page, 'about');
    await expect(page.getByRole('log').getByText(`About ${cvData.name}`)).toBeVisible();
    await runCommand(page, 'cd projects');
    await page.getByTestId('open-gui').click();
    await expect(page).toHaveURL(/\/gui$/);

    await page.getByTestId('back-to-terminal').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('log').getByText(`About ${cvData.name}`)).toBeVisible();
    await expect(page.getByText(WELCOME_SUBTITLE)).toHaveCount(0);
    await expect(page.getByLabel('Terminal command input')).toBeFocused();
    await runCommand(page, 'pwd');
    await expect(page.getByRole('log').getByText('/projects', { exact: true }).last()).toBeVisible();
    expect(await viewCookie(page)).toBe('terminal');
  });

  test('shares one session between the full terminal and the window, both ways', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await runCommand(page, 'education');
    await page.getByTestId('open-gui').click();
    await expect(page).toHaveURL(/\/gui$/);
    const windowLog = page.locator('#terminal').getByRole('log', { name: 'Terminal output' });
    await expect(windowLog).toContainText('education');

    const input = page.locator('#terminal').getByLabel('Terminal command input');
    await input.fill('whoami');
    await input.press('Enter');
    await page.getByTestId('back-to-terminal').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('log')).toContainText('whoami');
    await expect(page.getByRole('log')).toContainText('education');
  });

  for (const command of ['gui', 'startx']) {
    test(`typing ${command} opens the page`, async ({ page }) => {
      await page.goto('/');
      await runCommand(page, command);
      await expect(page).toHaveURL(/\/gui$/);
      await expect(page.locator('header#hero h1')).toBeAttached();
    });
  }

  test('a /startx link runs the command and switches to the page', async ({ page }) => {
    await page.goto('/startx');
    await expect(page).toHaveURL(/\/gui$/);
    await expect(page.locator('header#hero h1')).toBeAttached();
  });

  test('lands returning visitors on their last view', async ({ page }) => {
    await page.goto('/gui');
    await expect.poll(() => viewCookie(page)).toBe('gui');

    await page.goto('/');
    await expect(page).toHaveURL(/\/gui$/);

    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('log').getByText(/RAG Chatbot/).first()).toBeVisible();
    await page.goto('/?cmd=skills');
    await expect(page.getByRole('log').getByText('Skills', { exact: true })).toBeVisible();
  });

  test('stops redirecting once the visitor goes back to the terminal', async ({ page }) => {
    await page.goto('/gui');
    await page.getByTestId('back-to-terminal').click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('Terminal command input')).toBeVisible();
  });

  test('fits a 320px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/gui');
    await revealAll(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await expect(page.getByTestId('back-to-terminal')).toBeInViewport({ ratio: 1 });
    const box = await page.getByTestId('back-to-terminal').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('follows the device colour scheme', async ({ page }) => {
    await page.goto('/gui');
    const token = () => page.locator('.gui-root').evaluate((element) => getComputedStyle(element).getPropertyValue('--gui-bg').trim());
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await token();
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await token();
    expect(light).not.toBe('');
    expect(dark).not.toBe('');
    expect(dark).not.toBe(light);
  });

  test('does not follow the terminal theme', async ({ page }) => {
    await page.goto('/?cmd=theme%20dracula');
    await page.getByTestId('open-gui').click();
    await expect(page).toHaveURL(/\/gui$/);
    await page.emulateMedia({ colorScheme: 'light' });
    const background = await page.locator('.gui-root').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).toBe('rgb(42, 105, 167)');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no serious accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/gui');
      await revealAll(page);
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
      expect(blocking.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }

  test('points text clients at the page', async ({ request }) => {
    const response = await request.get('/gui', { headers: { 'user-agent': 'curl/8.0' } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Prefer a regular web page? Open');
    expect(await response.text()).toContain('/gui');
  });

  test('is indexable, self-canonical and listed in the sitemap', async ({ page, request }) => {
    const response = await request.get('/gui');
    expect(response.headers()['x-robots-tag']).toBeUndefined();
    await page.goto('/gui');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/gui$/);
    await expect(page).toHaveTitle(`${cvData.name} — Portfolio`);
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/gui');
  });
});

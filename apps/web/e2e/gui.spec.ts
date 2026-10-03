import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createShell, cvData, profile, WELCOME_SUBTITLE } from '@ahmed-moghazy/shared';

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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('gui-boot:v1', '1'));
  });

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

  test('first log shows the portfolio identity before about and clear removes it', async ({ page }) => {
    await page.goto('/gui');
    const log = page.locator('#terminal').getByRole('log', { name: 'Terminal output' });
    const identity = log.getByTestId('gui-identity');
    await expect(identity).toContainText(profile.name);
    await expect(identity).toContainText(profile.label);
    await expect(identity).toContainText(cvData.contact.location);
    await expect(identity).toBeInViewport({ ratio: 1 });
    await expect(log.locator(':scope > div').first().getByTestId('gui-identity')).toBeVisible();
    await expect(log.locator(':scope > div').nth(1)).toContainText(`About ${profile.name}`);
    await runCommand(page, 'clear');
    await expect(identity).toHaveCount(0);
  });

  test('desktop icons and Deskbar manage window state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    await page.getByRole('navigation', { name: 'Desktop' }).getByRole('button', { name: 'Projects' }).click();
    await expect(page.getByRole('navigation', { name: 'Desktop' }).getByRole('button', { name: 'Projects' })).toHaveClass(/is-selected/);
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

  test('rapid Deskbar clicks leave the window hidden and its entry unpressed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    const entry = page.locator('[data-window-entry="projects"]');
    await entry.dblclick();
    await expect(page.locator('#projects')).toBeHidden();
    await expect(entry).toHaveAttribute('aria-pressed', 'false');
    await expect(entry).toContainText('(minimized)');
  });

  test('desktop icon selection moves and clears on the desk background', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gui');
    const icons = page.getByRole('navigation', { name: 'Desktop' });
    const projects = icons.getByRole('button', { name: 'Projects' });
    const about = icons.getByRole('button', { name: 'About' });
    await projects.click();
    await expect(projects).toHaveClass(/is-selected/);
    await about.click();
    await expect(projects).not.toHaveClass(/is-selected/);
    await expect(about).toHaveClass(/is-selected/);
    await page.locator('.be-desk').dispatchEvent('pointerdown');
    await expect(about).not.toHaveClass(/is-selected/);
  });

  for (const [command, effect] of [['spidey', '.be-fx-web'], ['visca', '.be-fx-confetti']] as const) {
    test(`${command} plays and cleans up its desk effect`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/gui');
      const input = page.locator('#terminal').getByLabel('Terminal command input');
      await input.fill(command);
      await input.press('Enter');
      const node = page.locator(effect);
      if (test.info().project.name.includes('reduced')) {
        await expect(node).toHaveCount(0);
        await expect(page.locator('#terminal .be-term-log')).toContainText(command);
        await expect(node).toHaveCount(0);
      } else {
        await expect(node).toHaveCount(1);
        await expect(node).toHaveCount(0, { timeout: 2500 });
      }
    });
  }

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
    await expect(page.locator('.be-win.is-opening')).toHaveCount(0);
    const tabs: Array<{ id: string; x: number; y: number; right: number; bottom: number }> = [];
    for (const window of await page.locator('.be-win:visible').all()) {
      const box = await window.boundingBox();
      expect(box, (await window.getAttribute('id')) ?? undefined).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
      expect(box!.y + box!.height).toBeLessThanOrEqual(768);
      const tab = await window.locator('.be-tab').boundingBox();
      expect(tab).not.toBeNull();
      tabs.push({ id: (await window.getAttribute('id'))!, x: tab!.x, y: tab!.y, right: tab!.x + tab!.width, bottom: tab!.y + tab!.height });
    }
    for (let i = 0; i < tabs.length; i++) for (let j = i + 1; j < tabs.length; j++) {
      const a = tabs[i];
      const b = tabs[j];
      expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${a.id} and ${b.id} tabs overlap`).toBe(true);
    }
  });

  test('phone keeps the complete scrolling stack without desktop boxes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/gui');
    await expect(page.locator('.be-win:visible')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(844);
    await expect(page.locator('.be-box-close:visible, .be-box-zoom:visible, .be-box-collapse, .is-collapsed')).toHaveCount(0);
    await expect(page.locator('#terminal')).toBeVisible();
    const placement = await page.evaluate(() => {
      const terminal = document.querySelector('#terminal')!.getBoundingClientRect();
      const resume = document.querySelector('#hero')!.getBoundingClientRect();
      const chips = document.querySelector('#terminal .command-bar-desk')!.getBoundingClientRect();
      const dock = document.querySelector('.be-dock')!.getBoundingClientRect();
      return { terminalBottom: terminal.bottom, resumeTop: resume.top, chipsBottom: chips.bottom, dockTop: dock.top };
    });
    expect(placement.resumeTop).toBeGreaterThanOrEqual(placement.terminalBottom);
    expect(placement.chipsBottom).toBeLessThan(placement.dockTop);
    await expect(page.getByTestId('gui-identity')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('navigation', { name: 'Dock' }).getByRole('button', { name: 'Résumé' })).toBeVisible();
  });

  test('coarse-pointer secret grips have clear 44px targets', async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      baseURL: `http://localhost:${process.env.E2E_PORT || 3100}`,
    });
    try {
      await context.addInitScript(() => sessionStorage.setItem('gui-boot:v1', '1'));
      const page = await context.newPage();
      await page.goto('/gui');
      const grips = await page.locator('.be-grip').evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const controls = [...node.parentElement!.querySelectorAll('.be-body button, .be-body a, .be-body input, .be-body textarea')];
        const overlap = controls.some((control) => {
          const other = control.getBoundingClientRect();
          return other.width > 0 && other.height > 0 && box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom;
        });
        return { width: box.width, height: box.height, overlap };
      }));
      expect(grips).toHaveLength(2);
      for (const grip of grips) {
        expect(grip.width).toBeGreaterThanOrEqual(44);
        expect(grip.height).toBeGreaterThanOrEqual(44);
        expect(grip.overlap).toBe(false);
      }
    } finally {
      await context.close();
    }
  });

  test('keyboard focus visibly outlines the terminal input', async ({ page }) => {
    await page.goto('/');
    const input = page.getByLabel('Terminal command input');
    await input.click();
    await expect(input).not.toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('outline-style', 'solid');
    await expect(input).toHaveCSS('outline-width', '2px');
    for (const theme of ['matrix', 'dracula', 'nord', 'crt']) {
      await input.fill(`theme ${theme}`);
      await input.press('Enter');
      const ratio = await input.evaluate((node) => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const luminance = (value: string) => {
          const [r, g, b] = rgb(value).map((channel) => {
            const s = channel / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const outline = luminance(getComputedStyle(node).outlineColor);
        const background = luminance(getComputedStyle(document.body).backgroundColor);
        return (Math.max(outline, background) + 0.05) / (Math.min(outline, background) + 0.05);
      });
      expect(ratio, `${theme} focus contrast`).toBeGreaterThanOrEqual(3);
    }
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${cvData.name}, ${profile.label}`);
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
    await expect(windowLog.getByTestId('gui-identity')).toHaveCount(0);

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
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    });
  }

  test('a /startx link runs the command and switches to the page', async ({ page }) => {
    await page.goto('/startx');
    await expect(page).toHaveURL(/\/gui$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
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

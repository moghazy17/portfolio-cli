import { expect, test } from '@playwright/test';
import { content, cvData, executeCommand, itemIds, profile, themes, WELCOME_SUBTITLE } from '@ahmed-moghazy/shared';

test.describe('US1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal');
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

  test('renders filtered project lines and keeps quick commands available', async ({ page }) => {
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
    await page.getByRole('button', { name: 'All commands' }).click();
    await page.getByRole('dialog', { name: 'All commands' }).getByRole('button', { name: /about.*Professional summary/ }).click();
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('about');
  });

  test('keeps effects and later output when a chain clears or shows the welcome screen', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('whoami');
    await input.press('Enter');
    await input.fill('theme dracula && welcome');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe(themes.dracula.background);
    await expect(page.getByText(WELCOME_SUBTITLE)).toBeVisible();

    await input.fill('clear && about');
    await input.press('Enter');
    await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
    await expect(page.getByText(WELCOME_SUBTITLE)).toHaveCount(0);
    await expect(page.getByText('whoami', { exact: true })).toHaveCount(0);
  });

  test('runs commands joined to a pipe without spaces', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('ls|grep about');
    await input.press('Enter');
    await expect(page.getByText('about.md', { exact: true })).toBeVisible();
    await expect(page.getByText(/command not found/)).toHaveCount(0);
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

test.describe('US2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal');
  });

  test('browses the filesystem and resets cwd on reload', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('ls');
    await input.press('Enter');
    for (const entry of ['certifications/', 'experience/', 'projects/', 'about.md', 'resume.pdf']) {
      await expect(page.getByText(entry, { exact: true }).first()).toBeVisible();
    }

    await input.fill('cd projects');
    await input.press('Enter');
    await expect(page.getByText('visitor@portfolio:~/projects$', { exact: true })).toHaveCount(2);
    await input.fill('ls');
    await input.press('Enter');
    const id = itemIds(content).project[0];
    await expect(page.getByText(`${id}.md`, { exact: true })).toBeVisible();
    await input.fill(`cat ${id}.md`);
    await input.press('Enter');
    await expect(page.getByText(new RegExp(content.resume.projects[0].name)).first()).toBeVisible();

    await input.fill('cd nowhere');
    await input.press('Enter');
    await expect(page.getByText('cd: no such file or directory: nowhere')).toBeVisible();
    await input.fill('tree');
    await input.press('Enter');
    await expect(page.getByText(/\d+ directories, \d+ files/)).toBeVisible();

    await input.fill('pwd');
    await input.press('Enter');
    await expect(page.getByText('/projects', { exact: true })).toBeVisible();
    await input.fill('cat ../resume.pdf');
    await input.press('Enter');
    await expect(page.getByText("resume.pdf: PDF document — run 'resume' to download it")).toBeVisible();
    await input.fill('cat ~/about.md | grep -i data');
    await input.press('Enter');
    await expect(page.getByText(/data/i).last()).toBeVisible();

    const experienceId = itemIds(content).experience[0];
    await input.fill(`cat ~/experience/${experienceId.slice(0, -1)}`);
    await input.press('Tab');
    await expect(input).toHaveValue(`cat ~/experience/${experienceId}.md `);
    await input.press('Enter');
    await expect(page.getByText(content.resume.work[0].name, { exact: false }).first()).toBeVisible();

    await input.fill('mkdir x');
    await input.press('Enter');
    await expect(page.getByText("mkdir: read-only file system — this portfolio is look-but-don't-touch 🙂")).toBeVisible();
    await input.fill('rm about.md');
    await input.press('Enter');
    await expect(page.getByText("rm: read-only file system — this portfolio is look-but-don't-touch 🙂")).toBeVisible();
    await input.fill('rm -rf /');
    await input.press('Enter');
    await expect(page.getByText('Nice try. This portfolio is indestructible.')).toBeVisible();
    await input.fill('cd');
    await input.press('Enter');
    await expect(page.getByText('visitor@portfolio:~$', { exact: true }).last()).toBeVisible();
    await page.reload();
    await expect(page.getByText('visitor@portfolio:~$', { exact: true }).last()).toBeVisible();
  });
});

test.describe('US3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal');
  });

  test('shows manual pages, aliases, and missing-page hints', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    for (const command of ['man projects', 'man ls', 'man grep', 'man man', 'man exp']) {
      await input.fill(command);
      await input.press('Enter');
      await expect(page.getByText('SYNOPSIS', { exact: true }).last()).toBeVisible();
    }
    for (const command of ['man sudo', 'man nope']) {
      await input.fill(command);
      await input.press('Enter');
      await expect(page.getByText(`No manual entry for ${command.slice(4)}`, { exact: true })).toBeVisible();
    }
    await input.fill('man');
    await input.press('Enter');
    await expect(page.getByText('What manual page do you want?', { exact: true })).toBeVisible();
  });

  test('downloads the resume', async ({ page }) => {
    test.skip(!content.cv.available, 'The CV is not published in this repo');
    const input = page.getByLabel('Terminal command input');
    const downloadPromise = page.waitForEvent('download');
    await input.fill('resume');
    await input.press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-CV\.pdf$/);
    await expect(page.getByText('Downloading resume…')).toBeVisible();
  });

  test('plays the hire sequence and shows an email link', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('sudo hire-me');
    await input.press('Enter');
    // Animation frames are hidden from assistive technology; only the final output is announced.
    const progress = page.locator('[aria-hidden="true"] [role="progressbar"]').first();
    await expect(progress).toHaveText(/^verifying credentials [█░]{20} \d+%$/);
    await expect(progress).toHaveAttribute('aria-valuemin', '0');
    await expect(progress).toHaveAttribute('aria-valuemax', '100');
    await expect(page.getByText('ACCESS GRANTED', { exact: true })).toBeVisible({ timeout: 5000 });
    const mailto = page.locator('a[href^="mailto:"]');
    await expect(mailto).toBeVisible({ timeout: 5000 });
    const href = await mailto.getAttribute('href');
    const emailUrl = new URL(href!);
    expect(emailUrl.searchParams.get('subject')).toBe(`Hiring inquiry via ${new URL(page.url()).host}`);
    expect(emailUrl.searchParams.get('body')?.startsWith(`Hi ${profile.firstName},`)).toBe(true);
  });

  test('Ctrl+C skips the hire sequence and keeps the prompt usable', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('sudo hire-me');
    await input.press('Enter');
    await input.press('Control+c');
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible({ timeout: 200 });
    await expect(page.getByText(`Email:    ${cvData.contact.email}`, { exact: true }).last()).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toBeEnabled();
  });

  test('finishes the hire sequence before the next command output', async ({ page }) => {
    const input = page.getByLabel('Terminal command input');
    await input.fill('sudo hire-me');
    await input.press('Enter');
    await input.fill('about');
    await input.press('Enter');
    const mailto = page.locator('a[href^="mailto:"]');
    const about = page.getByText(`About ${cvData.name}`, { exact: true });
    await expect(mailto).toBeVisible();
    await expect(about).toBeVisible();
    expect(await mailto.evaluate((link, heading) => {
      const aboutHeading = [...document.querySelectorAll('div')].find((node) => node.textContent === heading);
      return aboutHeading ? Boolean(link.compareDocumentPosition(aboutHeading) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    }, `About ${cvData.name}`)).toBe(true);
  });

  test('shows only final output with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const input = page.getByLabel('Terminal command input');
    await input.fill('sudo hire-me');
    await input.press('Enter');
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('keeps whoami output equal to the shared command result', async ({ page }) => {
    const result = await executeCommand('whoami');
    const input = page.getByLabel('Terminal command input');
    await input.fill('whoami');
    await input.press('Enter');
    const expected = result.output.flatMap((block) => block.type === 'text' ? [block.content] : []);
    await expect(page.getByText(expected.at(-1)!, { exact: true })).toBeVisible();
    const rendered = await page.getByText('whoami', { exact: true })
      .locator('..').locator('..').locator(':scope > div:nth-child(2) > div').allTextContents();
    expect(rendered).toEqual(expected);
  });
});

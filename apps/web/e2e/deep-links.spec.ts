import { expect, test, type Page } from '@playwright/test';
import { cvData, themes, WELCOME_SUBTITLE } from '@ahmed-moghazy/shared';

type ChatRequest = { messages: unknown[]; surface: string };
const nonRagProject = cvData.projects.find((project) => !project.name.toLowerCase().includes('rag'));

if (!nonRagProject) throw new Error('Expected a project title without "rag".');

function chatStream(): string {
  const chunks = [
    { type: 'start' },
    { type: 'start-step' },
    { type: 'text-start', id: 'answer' },
    { type: 'text-delta', id: 'answer', delta: 'RAG work is available in the project list.' },
    { type: 'text-end', id: 'answer' },
    { type: 'finish-step' },
    { type: 'finish' },
  ];
  return [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'].join('');
}

async function stubChat(page: Page): Promise<() => ChatRequest[]> {
  const requests: ChatRequest[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: chatStream(),
    });
  });
  return () => requests;
}

test.describe('Deep links', () => {
  test('/projects keeps the welcome and runs within two seconds', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('log').getByText(/RAG Chatbot \(LangChain \+ FAISS \+ Ollama\)/)).toBeVisible({ timeout: 2000 });
    await expect(page.getByText(WELCOME_SUBTITLE)).toBeVisible();
  });

  test('runs a pipeline from a cmd query', async ({ page }) => {
    await page.goto('/?cmd=projects%20%7C%20grep%20-i%20rag');
    await expect(page.getByText(/RAG Chatbot/i).first()).toBeVisible();
    await expect(page.getByText(nonRagProject.name, { exact: true })).toHaveCount(0);
  });

  test('does not open a popup for an open link', async ({ page }) => {
    let popups = 0;
    page.on('popup', () => { popups += 1; });
    await page.goto('/?cmd=open%20github');
    await expect(page.getByText('Opened from a link, so nothing was opened or downloaded')).toBeVisible();
    expect(popups).toBe(0);
  });

  test('does not download for a resume link', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => { downloads += 1; });
    await page.goto('/resume');
    await expect(page.getByText('Opened from a link, so nothing was opened or downloaded')).toBeVisible();
    expect(downloads).toBe(0);
  });

  test('does not reapply a consumed question link after exiting chat', async ({ page }) => {
    const requests = await stubChat(page);
    const question = 'what RAG work has he done?';
    await page.goto(`/?cmd=${encodeURIComponent(question)}`);
    const input = page.getByLabel('Terminal command input');
    await expect(input).toHaveValue(question);
    await expect(input).toBeFocused();
    expect(requests()).toHaveLength(0);
    await input.press('Enter');
    await expect(page.getByText('RAG work is available in the project list.')).toBeVisible();
    expect(requests()).toHaveLength(1);
  });

  test('shows a notice for an oversized link', async ({ page }) => {
    await page.goto(`/?cmd=${'a'.repeat(201)}`);
    await expect(page.getByText("This link couldn't be used")).toBeVisible();
    await expect(page.getByText('command not found')).toHaveCount(0);
  });

  test('replaces history for commands and resets it for clear', async ({ page }) => {
    await page.goto('/terminal');
    const entries = await page.evaluate(() => window.history.length);
    const input = page.getByLabel('Terminal command input');
    for (const command of ['about', 'skills']) {
      await input.fill(command);
      await input.press('Enter');
    }
    await expect.poll(() => page.url()).toMatch(/\/skills$/);
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
    await page.goto('/projects');
    const resetInput = page.getByLabel('Terminal command input');
    await resetInput.fill('clear');
    await resetInput.press('Enter');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/terminal');
  });

  test('keeps a command chain that follows a clear in the address', async ({ page }) => {
    await page.goto('/terminal');
    const input = page.getByLabel('Terminal command input');
    await input.fill('clear && projects');
    await input.press('Enter');
    await expect.poll(() => decodeURIComponent(new URL(page.url()).searchParams.get('cmd') ?? ''))
      .toBe('clear && projects');
    await page.goto(page.url());
    await expect(page.getByText(/RAG Chatbot/i).first()).toBeVisible();
  });

  test('includes the previous directory in a relative command link', async ({ page }) => {
    await page.goto('/terminal');
    const input = page.getByLabel('Terminal command input');
    await input.fill('cd projects');
    await input.press('Enter');
    await input.fill('ls');
    await input.press('Enter');
    await expect.poll(() => decodeURIComponent(new URL(page.url()).searchParams.get('cmd') ?? '')).toBe('cd /projects && ls');
  });

  test('does not change the URL for a typed question', async ({ page }) => {
    const requests = await stubChat(page);
    await page.goto('/projects');
    const url = page.url();
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText('RAG work is available in the project list.')).toBeVisible();
    expect(page.url()).toBe(url);
    expect(requests()).toHaveLength(1);
  });

  test('runs close typos and prefills unknown paths without asking', async ({ page }) => {
    const requests = await stubChat(page);
    const typo = await page.request.get('/projct');
    expect(typo.headers()['x-robots-tag']).toBe('noindex');
    await page.goto('/projct');
    await expect(page.getByText('did you mean `projects`?')).toBeVisible();
    await expect(page.getByLabel('Terminal command input')).toHaveValue('');

    await page.goto('/?cmd=projct');
    await expect(page.getByText('did you mean `projects`?')).toBeVisible();
    await expect(page.getByLabel('Terminal command input')).toHaveValue('');

    await page.goto('/whatever/else');
    await expect(page.getByLabel('Terminal command input')).toHaveValue('whatever else');
    expect(requests()).toHaveLength(0);
  });

  test('applies a linked theme without persisting it', async ({ page }) => {
    await page.goto('/?cmd=theme%20dracula');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()))
      .toBe(themes.dracula.background);
    await page.goto('/terminal');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()))
      .toBe(themes.matrix.background);
  });

  test('prevents framing on public routes', async ({ request }) => {
    for (const path of ['/', '/projects']) {
      const response = await request.get(path);
      expect(response.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
      expect(response.headers()['x-frame-options']).toBe('DENY');
    }
  });
});

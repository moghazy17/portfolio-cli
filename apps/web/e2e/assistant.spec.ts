import { expect, test, type Page } from '@playwright/test';

type Chunk = Record<string, unknown>;

const COMMAND_LINE = 'projects | grep -i rag';
const COMMAND_TEXT = 'demo-project: Stack: Python, RAG';
const SUMMARY = 'One project uses RAG: demo-project.';
const SOURCES_LINE = `sources: ${COMMAND_LINE}`;

const commandPart = (): Chunk => ({
  type: 'data-command',
  data: { id: 'c1', commandLine: COMMAND_LINE, output: [{ type: 'text', content: COMMAND_TEXT }], status: 'ok' },
});
const textParts = (text: string, id = 't1'): Chunk[] => [
  { type: 'text-start', id },
  { type: 'text-delta', id, delta: text },
  { type: 'text-end', id },
];
const sourcesPart = (): Chunk => ({
  type: 'data-sources',
  data: { commands: [COMMAND_LINE], evidence: [], repos: [] },
});
const noticePart = (kind: string, message: string): Chunk => ({ type: 'data-notice', data: { kind, message } });

const openChunks = (): Chunk[] => [{ type: 'start' }, { type: 'start-step' }];
const closeChunks = (): Chunk[] => [{ type: 'finish-step' }, { type: 'finish' }];
const answerChunks = (): Chunk[] => [
  ...openChunks(), commandPart(), ...textParts(SUMMARY), sourcesPart(), ...closeChunks(),
];

// A UI message stream: one `data: {json}` event per chunk, ended by `data: [DONE]`.
function sse(chunks: Chunk[]): string {
  return [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'].join('');
}

interface ChatStub {
  bodies: () => Array<{ messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>; surface: string }>;
}

async function stubChat(page: Page, respond: (request: number) => Chunk[]): Promise<ChatStub> {
  const bodies: ReturnType<ChatStub['bodies']> = [];
  await page.route('**/api/chat', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: sse(respond(bodies.length)),
    });
  });
  return { bodies: () => bodies };
}

// Serves the first chunks straight away and holds the stream open until the test calls
// `window.__finishChat()`. Route fulfilment cannot deliver a body in pieces, so the
// endpoint is stubbed at fetch level for the tests that need a stream in flight.
async function stubSlowChat(page: Page) {
  await page.addInitScript(({ headBody, tailBody }) => {
    const w = window as unknown as { __chatRequests: number; __finishChat: () => void };
    w.__chatRequests = 0;
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!new URL(url, window.location.href).pathname.endsWith('/api/chat')) return realFetch(input, init);
      w.__chatRequests += 1;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(headBody));
          w.__finishChat = () => {
            try {
              controller.enqueue(encoder.encode(tailBody));
              controller.close();
            } catch {
              // the request was already aborted
            }
          };
          init?.signal?.addEventListener('abort', () => {
            try { controller.error(new DOMException('Aborted', 'AbortError')); } catch { /* already closed */ }
          });
        },
      });
      return Promise.resolve(new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      }));
    };
  }, {
    headBody: sse([...openChunks(), commandPart()]).replace('data: [DONE]\n\n', ''),
    tailBody: sse([...textParts(SUMMARY), sourcesPart(), ...closeChunks()]),
  });
}

const chatRequests = (page: Page) => page.evaluate(
  () => (window as unknown as { __chatRequests: number }).__chatRequests);
const finishChat = (page: Page) => page.evaluate(
  () => (window as unknown as { __finishChat: () => void }).__finishChat());

test.describe('Assistant answers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('answers a question in the shell with the command, summary and sources', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        body: sse(answerChunks()),
      });
    });
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText('thinking…')).toBeVisible();
    await expect(page.getByText(`↳ ${COMMAND_LINE}`)).toBeVisible();
    await expect(page.getByText(COMMAND_TEXT)).toBeVisible();
    await expect(page.getByText(SUMMARY)).toBeVisible();
    await expect(page.getByText(SOURCES_LINE)).toBeVisible();
    await expect(page.getByText('thinking…')).toHaveCount(0);
  });

  test('suggests a command for a typo without calling the assistant', async ({ page }) => {
    const stub = await stubChat(page, () => answerChunks());
    const input = page.getByLabel('Terminal command input');
    await input.fill('projcts');
    await input.press('Enter');
    await expect(page.getByText('did you mean `projects`?')).toBeVisible();
    expect(stub.bodies()).toHaveLength(0);
  });

  test('keeps a piped unknown command local', async ({ page }) => {
    const stub = await stubChat(page, () => answerChunks());
    const input = page.getByLabel('Terminal command input');
    await input.fill('who is he | grep python');
    await input.press('Enter');
    await expect(page.getByLabel('Terminal command input')).toHaveValue('');
    await expect(page.getByText('command not found').first()).toBeVisible();
    expect(stub.bodies()).toHaveLength(0);
  });

  test('sends the previous exchange with a follow-up question', async ({ page }) => {
    const stub = await stubChat(page, () => answerChunks());
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(SOURCES_LINE)).toBeVisible();
    await expect(page.locator('.assistant-answer[aria-busy="false"]')).toHaveCount(1);

    await input.fill('and which of those is newest?');
    await input.press('Enter');
    await expect(page.getByText(SOURCES_LINE)).toHaveCount(2);

    const bodies = stub.bodies();
    expect(bodies).toHaveLength(2);
    const texts = bodies[1].messages.map((message) => ({
      role: message.role,
      text: message.parts.filter((part) => part.type === 'text').map((part) => part.text).join(''),
    }));
    expect(bodies[1].surface).toBe('web');
    expect(texts).toEqual([
      { role: 'user', text: 'what RAG work has he done?' },
      { role: 'assistant', text: SUMMARY },
      { role: 'user', text: 'and which of those is newest?' },
    ]);
  });

  test('shows a limit notice and keeps commands working', async ({ page }) => {
    const limit = 'You have reached the question limit — commands like `projects` still work.';
    await stubChat(page, () => [...openChunks(), noticePart('limited', limit), ...closeChunks()]);
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(limit)).toBeVisible();
    await expect(page.locator('.assistant-answer[aria-busy="false"]')).toHaveCount(1);

    await input.fill('projects');
    await input.press('Enter');
    await expect(page.getByText('Projects').first()).toBeVisible();
    await expect(page.getByText(limit)).toHaveCount(1);
  });

  test('renders the same command part in chat mode', async ({ page }) => {
    const stub = await stubChat(page, () => answerChunks());
    const input = page.getByLabel('Terminal command input');
    await input.fill('chat');
    await input.press('Enter');
    const chatInput = page.getByLabel('Chat input');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('what RAG work has he done?');
    await chatInput.press('Enter');
    await expect(page.getByText(`↳ ${COMMAND_LINE}`)).toBeVisible();
    await expect(page.getByText(COMMAND_TEXT)).toBeVisible();
    await expect(page.getByText(SUMMARY)).toBeVisible();
    await expect(page.getByText(SOURCES_LINE)).toBeVisible();
    await expect(page.locator('.assistant-answer[aria-busy="false"]')).toHaveCount(1);
    expect(stub.bodies()[0].surface).toBe('web');

    await chatInput.fill('exit');
    await chatInput.press('Enter');
    await expect(input).toBeVisible();
  });

  test('shares the conversation between the shell and chat mode', async ({ page }) => {
    const stub = await stubChat(page, () => answerChunks());
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(SOURCES_LINE)).toBeVisible();
    await expect(page.locator('.assistant-answer[aria-busy="false"]')).toHaveCount(1);

    await input.fill('chat');
    await input.press('Enter');
    const chatInput = page.getByLabel('Chat input');
    await chatInput.fill('and which of those is newest?');
    await chatInput.press('Enter');
    await expect(page.getByText(SOURCES_LINE)).toHaveCount(2);
    const roles = stub.bodies()[1].messages.map((message) => message.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });
});

test.describe('Assistant streaming', () => {
  test('marks the answer busy while streaming and idle when done', async ({ page }) => {
    await stubSlowChat(page);
    await page.goto('/');
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(COMMAND_TEXT)).toBeVisible();
    await expect(page.getByText(SUMMARY)).toHaveCount(0);
    await expect(page.locator('.assistant-answer')).toHaveAttribute('aria-busy', 'true');

    await finishChat(page);
    await expect(page.getByText(SUMMARY)).toBeVisible();
    await expect(page.getByText(SOURCES_LINE)).toBeVisible();
    await expect(page.locator('.assistant-answer')).toHaveAttribute('aria-busy', 'false');
  });

  test('Ctrl+C during a slow stream stops output and restores the prompt', async ({ page }) => {
    await stubSlowChat(page);
    await page.goto('/');
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(COMMAND_TEXT)).toBeVisible();

    await input.press('Control+c');
    await expect(page.getByText('^C', { exact: true })).toBeVisible();
    await expect(page.locator('.assistant-answer')).toHaveAttribute('aria-busy', 'false');

    await finishChat(page);
    await expect(page.getByText(SUMMARY)).toHaveCount(0);
    await expect(page.getByText(SOURCES_LINE)).toHaveCount(0);

    await input.fill('about');
    await input.press('Enter');
    await expect(page.getByText('About ', { exact: false }).first()).toBeVisible();
    expect(await chatRequests(page)).toBe(1);
  });

  test('Ctrl+L during a slow stream clears the screen and keeps the prompt usable', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await stubSlowChat(page);
    await page.goto('/');
    const input = page.getByLabel('Terminal command input');
    await input.fill('what RAG work has he done?');
    await input.press('Enter');
    await expect(page.getByText(COMMAND_TEXT)).toBeVisible();

    await input.press('Control+l');
    await expect(page.getByText(COMMAND_TEXT)).toHaveCount(0);
    await expect(page.locator('.assistant-answer')).toHaveCount(0);

    await finishChat(page);
    await expect(page.getByText(SUMMARY)).toHaveCount(0);

    await input.fill('about');
    await input.press('Enter');
    await expect(page.getByText('About ', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(SUMMARY)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

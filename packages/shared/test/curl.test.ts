import { describe, expect, it, vi } from 'vitest';
import {
  parseAddress,
  rateLimitedResponse,
  routableCommandNames,
  runTextRequest,
  WELCOME_HINT,
  type GitHubStats,
} from '../src';

const origin = 'https://example.test';

const github: GitHubStats = {
  user: { publicRepos: 1, followers: 2, following: 3, bio: 'Builder', accountAge: 4 },
  ownRepos: [], totalStars: 0, topLanguages: [], topRepos: [],
};

function request(pathname: string, search = '', color = false) {
  return runTextRequest({ address: parseAddress(pathname, search), color, origin });
}

describe('curl surface', () => {
  it('renders a guide at the root without interactive-terminal guidance', async () => {
    const response = await request('/');
    expect(response.status).toBe(200);
    expect(response.body).toContain('/projects');
    expect(response.body).toContain('/skills/');
    expect(response.body).toContain('--data-urlencode "cmd=projects | grep -i rag"');
    expect(response.body).not.toMatch(/curl "[^"]*\s[^"]*"/);
    expect(response.body).toContain('nocolor');
    expect(response.body).toContain(origin);
    expect(response.body).not.toContain(WELCOME_HINT);
  });

  it('runs every routable command that is available on curl', async () => {
    for (const command of routableCommandNames) {
      if (['chat', 'ask', 'ai', 'theme', 'clear', 'cls', 'github', 'gh'].includes(command)) continue;
      const line = command === 'man' ? 'man projects' : command === 'cat' ? 'cat about.md' : command;
      const response = await request('/', `?cmd=${encodeURIComponent(line)}`);
      expect(response.status, command).toBe(200);
      expect(response.body, command).not.toBe('');
    }
  });

  it('rejects interactive-only commands with a link to the terminal', async () => {
    for (const line of ['chat', 'theme dracula', 'clear']) {
      const response = await request('/', `?cmd=${encodeURIComponent(line)}`);
      expect(response.status).toBe(400);
      expect(response.body).toContain('only available in the interactive terminal');
      expect(response.body).toContain(`${origin}/${line.split(' ')[0]}`);
    }
  });

  it('does not ask the assistant for unknown input', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const line of ['nonsense', 'what is his stack?']) {
      const response = await request('/', `?cmd=${encodeURIComponent(line)}`);
      expect(response.status).toBe(404);
      expect(response.body).toContain('command not found');
      expect(response.body).toContain(`open ${origin} to ask the AI`);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('renders invalid and non-command paths as text responses', async () => {
    const invalid = await request('/', `?cmd=${'a'.repeat(201)}`);
    expect(invalid.status).toBe(404);
    expect(invalid.body).toContain("this link couldn't be used");
    const unknown = await request('/whatever/else');
    expect(unknown.status).toBe(404);
    expect(unknown.body).toContain('command not found');
    const hidden = await request('/sudo/hire-me');
    expect(hidden.status).toBe(200);
    expect(hidden.body).toContain("Welcome aboard");
    expect(hidden.body).not.toContain('****');
  });

  it('supports color selection and the injected GitHub provider', async () => {
    const plain = await request('/projects', '', false);
    const colored = await request('/projects', '', true);
    expect(plain.body).not.toContain('\x1b');
    expect(colored.body).toContain('\x1b[');
    const provider = vi.fn(async () => github);
    const response = await runTextRequest({ address: parseAddress('/github', ''), color: false, origin, github: provider });
    expect(response.status).toBe(200);
    expect(response.body).toContain('Public Repos');
    expect(provider).toHaveBeenCalledOnce();
  });

  it('always terminates the body with a newline', async () => {
    expect((await request('/projects')).body.endsWith('\n')).toBe(true);
  });
});

describe('curl rate limiting', () => {
  it('allows successful checks and fails open for absent or failed limiters', async () => {
    expect(await rateLimitedResponse({ limit: async () => ({ success: true, reset: 0 }) }, 'visitor')).toBeNull();
    expect(await rateLimitedResponse(null, 'visitor')).toBeNull();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await rateLimitedResponse({ limit: async () => { throw new Error('offline'); } }, 'visitor')).toBeNull();
    error.mockRestore();
  });

  it('returns a rounded retry interval for a denied request', async () => {
    const now = 1_000;
    const response = await rateLimitedResponse({ limit: async () => ({ success: false, reset: now + 12_500 }) }, 'visitor', now);
    expect(response).toMatchObject({ status: 429, retryAfter: 13 });
    expect(response?.body).toBe('Slow down — 60 requests per minute. Try again in 13s.\n');
  });
});

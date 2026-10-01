import { expect, test } from '@playwright/test';
import { cvData } from '@ahmed-moghazy/shared';

const curl = { 'User-Agent': 'curl/8.7.1' };

test.describe('curl surface', () => {
  test('serves terminal text to text clients and HTML to browsers', async ({ request }) => {
    const colored = await request.get('/projects', { headers: curl });
    expect(colored.status()).toBe(200);
    expect(colored.headers()['content-type']).toMatch(/^text\/plain/);
    expect(await colored.text()).toContain('\x1b[');
    expect(await colored.text()).toContain(cvData.projects[0].name);

    const plain = await request.get('/projects?nocolor', { headers: curl });
    expect(plain.status()).toBe(200);
    expect(await plain.text()).not.toContain('\x1b');

    const pipeline = await request.get('/?cmd=projects%20%7C%20grep%20-i%20rag', { headers: curl });
    expect(pipeline.status()).toBe(200);

    const unknown = await request.get('/nonsense', { headers: curl });
    expect(unknown.status()).toBe(404);
    expect(await unknown.text()).toContain('command not found');

    const question = await request.get('/?cmd=what%20is%20his%20stack', { headers: curl });
    expect(question.status()).toBe(404);
    expect(await question.text()).toContain('command not found');

    const root = await request.get('/', { headers: curl });
    expect(root.status()).toBe(200);
    expect(await root.text()).toContain('/projects');

    const browser = await request.get('/projects', { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0' } });
    expect(browser.status()).toBe(200);
    expect(browser.headers()['content-type']).toMatch(/^text\/html/);

    const api = await request.get('/api/content', { headers: curl });
    expect(api.headers()['content-type']).toMatch(/^application\/json/);
  });
});

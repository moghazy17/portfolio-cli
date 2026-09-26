import { expect, test } from '@playwright/test';
import { content, cvData, site } from '@ahmed-moghazy/shared';

test('home page renders content and command output', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(site.title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', site.description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', site.ogDescription);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', site.twitterDescription);
  await expect(page.locator('article.sr-only')).toContainText(cvData.name);

  const input = page.getByLabel('Terminal command input');
  await input.fill('about');
  await input.press('Enter');
  await expect(page.getByText(`About ${cvData.name}`)).toBeVisible();
  await expect(
    page.locator('.terminal-container').getByText(
      cvData.professionalSummary.slice(0, 80),
      { exact: false },
    ),
  ).toBeVisible();
});

test('content API supports caching and conditional requests', async ({ request }) => {
  const response = await request.get('/api/content');
  expect(response.status()).toBe(200);
  expect(response.headers().etag).toBeTruthy();
  expect(response.headers()['cache-control']).toContain('s-maxage=300');
  const body = await response.json();
  expect(body.content.schemaVersion).toBe(1);
  expect(body.content.site).toBeTruthy();
  expect(body.content.writeups).toBeTruthy();
  expect(body.version).toBe(response.headers().etag?.replaceAll('"', ''));

  const conditional = await request.get('/api/content', {
    headers: { 'If-None-Match': response.headers().etag },
  });
  expect(conditional.status()).toBe(304);
});

test('reports CV availability accurately', async ({ request }) => {
  const response = await request.get('/cv/latest.pdf');
  expect(content.cv.available).toBe(response.status() === 200);
  if (response.status() === 200) {
    expect(response.headers()['content-type']).toContain('application/pdf');
  }
});

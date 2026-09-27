import { describe, expect, it } from 'vitest';
import { content, cvData, profile } from '../src/content';
import { createShell } from '../src/shell/shell';

const origin = 'https://example.test';
const shell = () => createShell({ surface: 'web', origin });

describe('sudo hire-me', () => {
  it('has a bounded cumulative sequence with password, progress, and success frames', async () => {
    const result = await shell().run('sudo hire-me');
    expect(result.sequence).toBeDefined();
    expect(result.sequence!.reduce((total, frame) => total + frame.delayMs, 0)).toBeLessThanOrEqual(3500);
    expect(result.sequence!.some((frame) => frame.output.some((node) => node.type === 'text' && node.content.includes('********')))).toBe(true);
    for (const label of ['verifying credentials', 'checking coffee supply', 'granting access']) {
      expect(result.sequence!.some((frame) => frame.output.some((node) => node.type === 'progress' && node.label === label))).toBe(true);
    }
    expect(result.sequence!.at(-1)?.output).toContainEqual(expect.objectContaining({
      type: 'text', content: 'ACCESS GRANTED', style: expect.objectContaining({ bold: true, color: 'success' }),
    }));
  });

  it('returns content-derived contact details with a prefilled origin-aware email', async () => {
    const result = await shell().run('sudo hire-me');
    expect(result.output).toContainEqual({ type: 'text', content: cvData.name });
    expect(result.output).toContainEqual({ type: 'text', content: `Email:    ${cvData.contact.email}` });
    expect(result.output).toContainEqual({ type: 'link', text: 'LinkedIn', url: cvData.contact.linkedin });
    const email = result.output.find((node) => node.type === 'link' && node.text === 'Send an email');
    expect(email).toBeDefined();
    if (email?.type !== 'link') return;
    const url = new URL(email.url);
    expect(url.searchParams.get('subject')).toBe(`Hiring inquiry via ${new URL(origin).host}`);
    expect(url.searchParams.get('body')).toMatch(new RegExp(`^Hi ${profile.firstName},`));
  });

  it('accepts hire variants, preserves the permission joke, and drops sequences in pipes', async () => {
    const sh = shell();
    const expected = (await sh.run('sudo hire-me')).output;
    for (const command of ['sudo hire', `sudo hire ${profile.firstName.toLowerCase()}`, 'sudo hire-x']) {
      expect((await sh.run(command)).output).toEqual(expected);
    }
    expect(await sh.run('sudo ls')).toMatchObject({ output: expect.arrayContaining([
      { type: 'text', content: 'Hint: try "sudo hire-me"', style: { dim: true } },
    ]) });
    expect((await sh.run('sudo hire-me | wc -l')).sequence).toBeUndefined();
    expect(content.resume.basics.name).toContain(profile.firstName);
  });
});

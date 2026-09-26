import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '../src/content/load';
import { toCVData } from '../src/content/view';
import { executeCommand } from '../src/commands';

const repoRoot = resolve(import.meta.dirname, '../../..');

describe('content round-trip', () => {
  it('loads the real content and maps it to CVData without losing entries', async () => {
    const loaded = await loadContent(repoRoot);

    expect(loaded.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(loaded.content).toBeDefined();

    expect(() => toCVData(loaded.content!)).not.toThrow();
    const content = loaded.content!;
    const cvData = toCVData(content);

    expect(cvData).toMatchObject({
      experience: expect.any(Array),
      projects: expect.any(Array),
      certifications: expect.any(Array),
      skills: expect.any(Array),
    });
    expect(cvData.experience).toHaveLength(content.resume.work.length);
    expect(cvData.projects).toHaveLength(content.resume.projects.length);
    expect(cvData.certifications).toHaveLength(content.resume.certificates.length);
    expect(cvData.skills).toHaveLength(content.resume.skills.length);
  });

  it('runs the migrated command surface', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      for (const command of [
        'about', 'education', 'experience', 'experience act', 'experience depi',
        'projects', 'projects rag', 'skills', 'skills llm', 'certifications',
        'contact', 'timeline', 'whoami', 'neofetch', 'welcome', 'hello', 'chat',
        'help', 'sudo hire-me',
      ]) {
        await expect(executeCommand(command)).resolves.toMatchObject({
          output: expect.arrayContaining([expect.any(Object)]),
        });
      }
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('finds every work entry by slug', async () => {
    const loaded = await loadContent(repoRoot);
    expect(loaded.content).toBeDefined();

    for (const work of loaded.content!.resume.work) {
      const result = await executeCommand(`experience ${work.slug}`);
      expect(result.output.some((output) => (
        output.type === 'section'
        && output.title.includes(work.name)
        && output.title.includes(work.position)
      ))).toBe(true);
    }
  });
});

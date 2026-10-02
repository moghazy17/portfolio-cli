import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';
import { PROMPT_EXAMPLES, suggestionsFor } from '../src/discover/suggestions';
import { tourSteps } from '../src/discover/tour';

describe('discoverability definitions', () => {
  it('offers first-visit next steps including a question and tour', () => {
    const items = suggestionsFor({ firstVisit: true, surface: 'web' });
    expect(items).toHaveLength(5);
    expect(items.some((item) => item.kind === 'question')).toBe(true);
    expect(items.some((item) => item.line === 'tour')).toBe(true);
  });

  it('offers registered visible next steps without repeating the command', () => {
    for (const command of commandRegistry.filter((entry) => !entry.hidden && (!entry.surfaces || entry.surfaces.includes('web')))) {
      const items = suggestionsFor({ firstVisit: false, lastCommand: command.name, surface: 'web' });
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(6);
      expect(items.some((item) => item.line === command.name)).toBe(false);
      for (const item of items.filter((entry) => entry.kind === 'command')) {
        const name = item.line.split(' ')[0];
        expect(commandRegistry.some((entry) => entry.name === name && !entry.hidden && (!entry.surfaces || entry.surfaces.includes('web')))).toBe(true);
      }
    }
    expect(suggestionsFor({ firstVisit: false, lastCommand: 'removed', surface: 'web' }).every((item) => item.line !== 'removed')).toBe(true);
    expect(suggestionsFor({ firstVisit: true, surface: 'curl' }).every((item) => item.kind === 'command')).toBe(true);
  });

  it('shares examples of commands, questions and hidden discoveries', () => {
    expect(PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(5);
    expect(PROMPT_EXAMPLES.some((example) => example.startsWith('try:'))).toBe(true);
    expect(PROMPT_EXAMPLES.some((example) => example.startsWith('ask:'))).toBe(true);
    expect(PROMPT_EXAMPLES.some((example) => example.includes('neofetch'))).toBe(true);
  });

  it('defines a bounded tour and exposes it only as a web effect', async () => {
    const steps = tourSteps();
    expect(steps.map((step) => step.line)).toEqual(['welcome', 'skills', 'What RAG work has he done?', 'theme crt', 'who']);
    expect(steps.find((step) => step.line === 'theme crt')?.motion).toBe(true);
    expect(steps.reduce((sum, step) => sum + step.pauseMs + step.line.length * 35, 0)).toBeLessThanOrEqual(70_000);
    expect((await createShell({ surface: 'web', origin: '' }).run('tour')).tour).toEqual(steps);
    const curl = await createShell({ surface: 'curl', origin: 'https://example.test' }).run('tour');
    expect(curl.tour).toBeUndefined();
    expect(curl.output).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', content: expect.stringContaining('web') })]));
  });
});

import { describe, expect, it } from 'vitest';
import { commandRegistry } from '../src/commands/registry';
import { createShell } from '../src/shell/shell';
import { PROMPT_EXAMPLES, promptExamplesFor, suggestionsFor } from '../src/discover/suggestions';
import { WELCOME_HINT, WELCOME_SHORTCUT_HINT } from '../src/ascii';
import { getMenuGroups, getMenuItems } from '../src/commands/engine';
import { tourSteps } from '../src/discover/tour';

describe('discoverability definitions', () => {
  it('uses the shared concise welcome hints', () => {
    expect(WELCOME_HINT).toBe('Tap a suggestion, or just type a command or question.');
    expect(WELCOME_HINT).not.toMatch(/arrow keys|menu below/i);
    expect(WELCOME_SHORTCUT_HINT).toBe('Press ? for shortcuts.');
  });

  it('groups every menu command exactly once', () => {
    const groups = getMenuGroups();
    expect(groups.map((group) => group.heading)).toEqual(['About me', 'Work', 'Explore']);
    expect(groups[0].items.map((item) => item.value).sort()).toEqual(['about', 'education', 'certifications', 'contact'].sort());
    expect(groups[1].items.map((item) => item.value).sort()).toEqual(['experience', 'projects', 'skills', 'timeline', 'github'].sort());
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    const values = groups.flatMap((group) => group.items.map((item) => item.value));
    const menu = getMenuItems().map((item) => item.value);
    expect(values).toHaveLength(menu.length);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...menu].sort());
  });

  it('filters matching prompt examples and falls back when exhausted', () => {
    const filtered = promptExamplesFor([' PROJECTS ', 'what rag work has he done?', 'TOUR']);
    expect(filtered).not.toContain('try: projects');
    expect(filtered).not.toContain('ask: What RAG work has he done?');
    expect(filtered).not.toContain('try: tour');
    expect(filtered).toContain('try: neofetch');
    expect(promptExamplesFor(PROMPT_EXAMPLES.map((example) => example.replace(/^(try|ask): /, '')))).toEqual(['try: neofetch']);
  });
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

  it('defines a guided tour and exposes it only as a web effect', async () => {
    const steps = tourSteps();
    expect(steps.map((step) => step.line)).toEqual(['about', 'skills', 'What RAG work has he done?', 'theme crt', 'who']);
    expect(steps.every((step) => !['welcome', 'clear'].includes(step.line))).toBe(true);
    expect(steps.every((step) => step.title.length > 0 && step.caption.length > 0 && step.caption.length <= 110)).toBe(true);
    expect(steps.every((step) => !('pauseMs' in step))).toBe(true);
    expect(steps.find((step) => step.line === 'theme crt')?.motion).toBe(true);
    expect((await createShell({ surface: 'web', origin: '' }).run('tour')).tour).toEqual(steps);
    const curl = await createShell({ surface: 'curl', origin: 'https://example.test' }).run('tour');
    expect(curl.tour).toBeUndefined();
    expect(curl.output).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', content: expect.stringContaining('web') })]));
  });
});

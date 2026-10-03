import { describe, expect, it } from 'vitest';
import { createShell } from '../src/shell/shell';
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
    expect(groups[0].items.map((item) => item.value).sort()).toEqual(['about', 'resume', 'education', 'certifications', 'contact'].sort());
    expect(groups[1].items.map((item) => item.value).sort()).toEqual(['experience', 'projects', 'skills', 'timeline', 'github'].sort());
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    const values = groups.flatMap((group) => group.items.map((item) => item.value));
    const menu = getMenuItems().map((item) => item.value);
    expect(values).toHaveLength(menu.length);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...menu].sort());
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

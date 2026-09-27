import { describe, expect, it } from 'vitest';
import { history } from '../src/shell/history';

describe('shell history', () => {
  it('ignores blanks and consecutive duplicates and keeps the latest 100', () => {
    let state = history.empty();
    state = history.push(state, ' ');
    expect(state.entries).toEqual([]);
    state = history.push(state, 'help');
    state = history.push(state, 'help');
    expect(state.entries).toEqual(['help']);
    for (let index = 0; index <= history.HISTORY_LIMIT; index++) state = history.push(state, `command ${index}`);
    expect(state.entries).toHaveLength(100);
    expect(state.entries[0]).toBe('command 1');
    expect(state.cursor).toBeNull();
    expect(state.draft).toBe('');
  });

  it('saves and restores a draft while browsing', () => {
    let state = ['help', 'projects', 'skills'].reduce(history.push, history.empty());
    state = history.up(state, 'draft');
    expect(state).toMatchObject({ cursor: 2, draft: 'draft' });
    state = history.up(state, 'ignored');
    state = history.up(state, 'ignored');
    state = history.up(state, 'ignored');
    expect(state.cursor).toBe(0);
    state = history.down(state);
    expect(state.entries[state.cursor!]).toBe('projects');
    state = history.down(state);
    state = history.down(state);
    expect(state).toMatchObject({ cursor: null, draft: 'draft' });
    expect(history.up(history.empty(), 'draft')).toEqual(history.empty());
  });
});

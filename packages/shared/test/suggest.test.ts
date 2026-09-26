import { describe, expect, it } from 'vitest';
import { suggestCommand } from '../src/shell/suggest';

describe('suggestCommand', () => {
  it.each([
    ['hepl', 'help'], ['hlp', 'help'], ['hx', undefined],
    ['projcts', 'projects'], ['experiance', 'experience'], ['certs', 'certifications'],
    ['sudp', undefined], ['neofech', undefined], ['who are you', undefined],
  ])('%s suggests %s', (word, expected) => {
    expect(suggestCommand(word)).toBe(expected);
  });

  it('uses registry order for equal distance', () => {
    expect(suggestCommand('abc', [
      { name: 'abd', aliases: [], hidden: false },
      { name: 'abe', aliases: [], hidden: false },
    ] as never)).toBe('abd');
  });
});

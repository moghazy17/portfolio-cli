import { describe, expect, it } from 'vitest';
import { bootSequence } from '../src/motion/boot';
import { shouldType, TYPE_MAX_LINES } from '../src/motion/reveal';

describe('terminal motion contracts', () => {
  it('keeps boot short and populated', () => {
    const steps = bootSequence();
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.reduce((sum, step) => sum + step.delayMs, 0)).toBeLessThanOrEqual(3000);
    expect(steps.every((step) => step.output.length > 0)).toBe(true);
  });
  it('uses rendered line count for typing', () => {
    expect(shouldType([{ type: 'text', content: Array(TYPE_MAX_LINES).fill('x').join('\n') }])).toBe(true);
    expect(shouldType([{ type: 'text', content: Array(TYPE_MAX_LINES + 1).fill('x').join('\n') }])).toBe(false);
  });
});

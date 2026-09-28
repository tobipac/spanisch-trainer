import { describe, expect, it } from 'vitest';
import { DREAMING_BEGINNER_FROM_STABLE_WORDS } from '../src/config/input.ts';
import { dreamingLevels, dreamingUrl } from '../src/domain/input.ts';

describe('Link zu Dreaming Spanish', () => {
  it('unter der Schwelle nur superbeginner, gesehene ausgeblendet', () => {
    expect(dreamingLevels(0)).toEqual(['superbeginner']);
    expect(dreamingUrl(DREAMING_BEGINNER_FROM_STABLE_WORDS - 1)).toBe(
      'https://app.dreaming.com/browse?level=superbeginner&hide-watched=true',
    );
  });

  it('ab der Schwelle zusätzlich beginner (Komma-Liste wie auf der Seite)', () => {
    expect(dreamingLevels(DREAMING_BEGINNER_FROM_STABLE_WORDS)).toEqual(['beginner', 'superbeginner']);
    expect(dreamingUrl(DREAMING_BEGINNER_FROM_STABLE_WORDS)).toBe(
      'https://app.dreaming.com/browse?level=beginner%2Csuperbeginner&hide-watched=true',
    );
  });
});

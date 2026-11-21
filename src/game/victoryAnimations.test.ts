import { describe, expect, it } from 'vitest';

import { MY_FIGHTERS } from './myFighters';
import { getCharacterVictoryProfile } from './victoryProfiles';

describe('victoryAnimations', () => {
  it('provides a distinct victory profile for every roster character', () => {
    const profiles = MY_FIGHTERS.map((fighter) => getCharacterVictoryProfile(fighter.id));
    const fxKinds = new Set(profiles.map((profile) => profile.fxKind));
    const quotes = new Set(profiles.map((profile) => profile.quote));

    expect(profiles.every((profile) => profile.id !== 'default')).toBe(true);
    expect(profiles.every((profile) => profile.sequence.length > 0)).toBe(true);
    expect(fxKinds.size).toBe(MY_FIGHTERS.length);
    expect(quotes.size).toBe(MY_FIGHTERS.length);
  });

  it('falls back gracefully for unknown character ids', () => {
    const fallback = getCharacterVictoryProfile('unknown-fighter');
    expect(fallback.id).toBe('default');
    expect(fallback.sequence.length).toBeGreaterThan(0);
  });
});

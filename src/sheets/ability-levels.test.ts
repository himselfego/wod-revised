import trim from 'lodash/trim';
import { describe, expect, it } from 'vitest';

import en from '../../lang/en.json';
import ru from '../../lang/ru.json';
import { ABILITY_IDS, ATTRIBUTE_IDS } from '../config';
import {
  ABILITY_LEVEL_MAX,
  abilityLevelKey,
  abilityLevelRank,
  attributeLevelKey,
} from './ability-levels';

const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

interface LangPack {
  WOD: {
    AbilityLevel: Record<string, Record<string, string>>;
    AttributeLevel: Record<string, Record<string, string>>;
  };
}

const levelsOf = (pack: LangPack): LangPack['WOD']['AbilityLevel'] => pack.WOD.AbilityLevel;

describe('ability level rank', () => {
  it('hides a line when there is no dot', () => {
    expect(abilityLevelRank(0)).toBeUndefined();
    expect(abilityLevelKey('brawl', 0)).toBeUndefined();
  });

  it('uses the current dot, and caps the scale at 10', () => {
    expect(abilityLevelRank(1)).toBe(1);
    expect(abilityLevelRank(6.9)).toBe(6);
    expect(abilityLevelRank(ABILITY_LEVEL_MAX + 4)).toBe(ABILITY_LEVEL_MAX);
    expect(abilityLevelKey('alertness', 3)).toBe('WOD.AbilityLevel.alertness.3');
    expect(abilityLevelKey('occult', 12)).toBe('WOD.AbilityLevel.occult.10');
    expect(attributeLevelKey('strength', 0)).toBeUndefined();
    expect(attributeLevelKey('strength', 4)).toBe('WOD.AttributeLevel.strength.4');
  });

  it('ignores a value that is not a number', () => {
    expect(abilityLevelRank(NaN)).toBeUndefined();
  });
});

describe('ability level copy', () => {
  it.each([
    ['ru', ru],
    ['en', en],
  ])('%s has a line for every ability from 1 to 10', (_name, pack) => {
    const levels = levelsOf(pack);
    const attributes = pack.WOD.AttributeLevel;

    for (const id of ABILITY_IDS) {
      for (const rank of RANKS) {
        expect(trim(levels[id]?.[rank] ?? '')).not.toBe('');
      }
    }

    for (const id of ATTRIBUTE_IDS) {
      for (const rank of RANKS) {
        expect(trim(attributes[id]?.[rank] ?? '')).not.toBe('');
      }
    }
  });
});

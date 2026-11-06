import type { WoundLevel } from './wound';

import constant from 'lodash/constant';
import map from 'lodash/map';
import times from 'lodash/times';
import { describe, expect, it } from 'vitest';

import { HEALTH_LEVELS } from '../../config';
import {
  isWoundStatusEffectId,
  WOUND_LEVEL_IDS,
  woundLevel,
  woundStatusEffectId,
} from './wound';

interface LevelCase {
  count: number;
  expected: WoundLevel | undefined;
  name: string;
}

const LEVEL_CASES: LevelCase[] = [
  { count: 0, expected: undefined, name: 'ignores an empty track' },
  { count: 1, expected: undefined, name: 'ignores bruised' },
  { count: 2, expected: { id: 'hurt', penalty: 1 }, name: 'reads hurt from the second box' },
  { count: 3, expected: { id: 'injured', penalty: 1 }, name: 'reads injured from the third box' },
  { count: 4, expected: { id: 'wounded', penalty: 2 }, name: 'reads wounded from the fourth box' },
  { count: 5, expected: { id: 'mauled', penalty: 2 }, name: 'reads mauled from the fifth box' },
  { count: 6, expected: { id: 'crippled', penalty: 5 }, name: 'reads crippled from the sixth box' },
  {
    count: 7,
    expected: { id: 'incapacitated', penalty: undefined },
    name: 'reads incapacitated without a dice penalty',
  },
  {
    count: 8,
    expected: { id: 'incapacitated', penalty: undefined },
    name: 'stops at incapacitated when the track is full',
  },
];

describe('woundLevel', () => {
  it.each(LEVEL_CASES)('$name', ({ count, expected }) => {
    expect(woundLevel(times(count, constant('bashing')))).toStrictEqual(expected);
  });

  it('packs mixed damage before choosing the rightmost box', () => {
    expect(woundLevel(['bashing', 'aggravated'])).toStrictEqual({ id: 'hurt', penalty: 1 });
  });

  it('ignores holes and keeps a single mark at bruised', () => {
    expect(woundLevel(['', 'bashing', ''])).toBeUndefined();
  });

  it('lists every health level after bruised', () => {
    expect(map(HEALTH_LEVELS, 'id').slice(1)).toStrictEqual([...WOUND_LEVEL_IDS]);
  });
});

describe('woundStatusEffectId', () => {
  it('prefixes the health level', () => {
    expect(woundStatusEffectId('mauled')).toBe('wod-mauled');
  });

  it('recognizes only prefixed wound statuses', () => {
    expect(isWoundStatusEffectId('wod-hurt')).toBe(true);
    expect(isWoundStatusEffectId('hurt')).toBe(false);
    expect(isWoundStatusEffectId('dead')).toBe(false);
  });
});

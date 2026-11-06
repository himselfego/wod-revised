import type { AbilityCategory } from '../config';
import type { PoolPart } from './pool';

import { describe, expect, it } from 'vitest';

import { formulaView, parsePoolAdjust } from './formula';
import { poolFormula, poolTotal } from './pool';

interface PartInput {
  category?: AbilityCategory;
  id: string;
  kind: PoolPart['kind'];
  label: string;
  value: number;
}

const part = ({
  category,
  id,
  kind,
  label,
  value,
}: PartInput): PoolPart => ({
  category,
  id,
  key: `${kind}:${id}`,
  kind,
  label,
  value,
});

const STRENGTH = part({
  id: 'strength',
  kind: 'attribute',
  label: 'Strength',
  value: 3,
});
const BRAWL = part({
  category: 'talents',
  id: 'brawl',
  kind: 'ability',
  label: 'Brawl',
  value: 2,
});
const DRIVE = part({
  category: 'skills',
  id: 'drive',
  kind: 'ability',
  label: 'Drive',
  value: 0,
});

describe('poolFormula', () => {
  it('returns an empty string for an empty pool', () => {
    expect(poolFormula([])).toBe('');
  });

  it('joins labels and ratings without a roll verb', () => {
    expect(poolFormula([STRENGTH, BRAWL])).toBe('Strength 3 + Brawl 2');
  });
});

describe('poolTotal', () => {
  it('sums part ratings', () => {
    expect(poolTotal([STRENGTH, BRAWL])).toBe(5);
  });
});

describe('formulaView', () => {
  it('puts the pool on the left and the effective threshold on the right', () => {
    expect(formulaView({
      declared: 6,
      parts: [STRENGTH, BRAWL],
      penalty: 0,
      specialization: undefined,
      willSpendWillpower: false,
    })).toStrictEqual({
      difficultyLedger: undefined,
      effectiveDifficulty: 6,
      formula: 'Strength 3 + Brawl 2',
      hasRiders: false,
      poolTotal: 5,
      specialization: undefined,
      willSpendWillpower: false,
    });
  });

  it('adds a difficulty ledger when a skill penalty raises the target', () => {
    expect(formulaView({
      declared: 6,
      parts: [STRENGTH, DRIVE],
      penalty: 1,
      specialization: undefined,
      willSpendWillpower: false,
    })).toMatchObject({
      difficultyLedger: '6 + 1',
      effectiveDifficulty: 7,
      formula: 'Strength 3 + Drive 0',
      poolTotal: 3,
    });
  });

  it('omits the ledger when the penalty does not raise the target', () => {
    expect(formulaView({
      declared: 10,
      parts: [STRENGTH, DRIVE],
      penalty: 1,
      specialization: undefined,
      willSpendWillpower: false,
    }).difficultyLedger).toBeUndefined();
  });

  it('puts the wound after traits and the manual term last', () => {
    expect(formulaView({
      adjust: 2,
      bonusLabel: 'бонус',
      declared: 6,
      parts: [STRENGTH, BRAWL],
      penalty: 0,
      penaltyLabel: 'штраф',
      specialization: undefined,
      willSpendWillpower: false,
      woundLabel: 'Боль',
      woundPenalty: 1,
    })).toMatchObject({
      formula: 'Strength 3 + Brawl 2 − Боль 1 + бонус 2',
      poolTotal: 6,
    });
  });

  it('uses the penalty word and clamps the dice at zero', () => {
    expect(formulaView({
      adjust: -4,
      bonusLabel: 'бонус',
      declared: 6,
      parts: [STRENGTH],
      penalty: 0,
      penaltyLabel: 'штраф',
      specialization: undefined,
      willSpendWillpower: false,
      woundLabel: 'Увечье',
      woundPenalty: 5,
    })).toMatchObject({
      formula: 'Strength 3 − Увечье 5 − штраф 4',
      poolTotal: 0,
    });
  });

  it('marks riders when a specialization or willpower is present', () => {
    expect(formulaView({
      declared: 6,
      parts: [STRENGTH, BRAWL],
      penalty: 0,
      specialization: 'Blades',
      willSpendWillpower: true,
    })).toMatchObject({
      hasRiders: true,
      specialization: 'Blades',
      willSpendWillpower: true,
    });
  });
});

describe('parsePoolAdjust', () => {
  it('reads a signed integer and treats a blank field as zero', () => {
    expect(parsePoolAdjust('+2')).toBe(2);
    expect(parsePoolAdjust('−3')).toBe(-3);
    expect(parsePoolAdjust('')).toBe(0);
    expect(parsePoolAdjust('-')).toBe(0);
    expect(parsePoolAdjust('2a')).toBeUndefined();
  });
});

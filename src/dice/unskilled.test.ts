import type { AbilityCategory } from '../config';
import type { PoolPart } from './pool';
import type { UnskilledState } from './unskilled';

import { describe, expect, it } from 'vitest';

import {
  effectiveDifficulty,
  hasUnskilledKnowledge,
  resolveUnskilled,
  shouldShowSkillPenalty,
} from './unskilled';

interface DifficultyCase {
  declared: number;
  expected: number;
  name: string;
  penalty: number;
}

interface PenaltyCase {
  declared: number;
  expected: boolean;
  name: string;
  unskilled: UnskilledState | undefined;
}

interface UnskilledCase {
  expected: UnskilledState | undefined;
  isUnskilledKnowledgeAllowed?: boolean;
  name: string;
  parts: PoolPart[];
}

const part = (
  kind: PoolPart['kind'],
  id: string,
  value: number,
  category?: AbilityCategory,
): PoolPart => ({
  category,
  id,
  key: `${kind}:${id}`,
  kind,
  label: id,
  value,
});

const UNSKILLED_CASES: UnskilledCase[] = [
  {
    expected: undefined,
    name: 'ignores an empty pool',
    parts: [],
  },
  {
    expected: undefined,
    name: 'ignores attributes',
    parts: [part('attribute', 'perception', 3)],
  },
  {
    expected: undefined,
    name: 'ignores a talent with dots',
    parts: [part('ability', 'alertness', 1, 'talents')],
  },
  {
    expected: {
      blocked: false,
      category: 'talents',
      penalty: 0,
    },
    name: 'treats a talent at zero as unskilled without a penalty',
    parts: [part('ability', 'alertness', 0, 'talents')],
  },
  {
    expected: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
    name: 'adds a difficulty penalty for a skill at zero',
    parts: [part('ability', 'performance', 0, 'skills')],
  },
  {
    expected: undefined,
    name: 'ignores a skill with dots',
    parts: [part('ability', 'performance', 1, 'skills')],
  },
  {
    expected: {
      blocked: true,
      category: 'knowledges',
      penalty: 0,
    },
    name: 'blocks a knowledge at zero',
    parts: [part('ability', 'academics', 0, 'knowledges')],
  },
  {
    expected: {
      blocked: false,
      category: 'knowledges',
      penalty: 0,
    },
    isUnskilledKnowledgeAllowed: true,
    name: 'allows a knowledge at zero when the owner permits it',
    parts: [part('ability', 'academics', 0, 'knowledges')],
  },
  {
    expected: undefined,
    name: 'ignores a knowledge with dots',
    parts: [part('ability', 'academics', 1, 'knowledges')],
  },
  {
    expected: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
    name: 'prefers a skill penalty over a talent at zero',
    parts: [
      part('ability', 'alertness', 0, 'talents'),
      part('ability', 'performance', 0, 'skills'),
    ],
  },
  {
    expected: {
      blocked: true,
      category: 'knowledges',
      penalty: 0,
    },
    name: 'prefers a knowledge block over a skill at zero',
    parts: [
      part('ability', 'performance', 0, 'skills'),
      part('ability', 'academics', 0, 'knowledges'),
    ],
  },
  {
    expected: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
    isUnskilledKnowledgeAllowed: true,
    name: 'keeps a skill penalty when a knowledge at zero is allowed',
    parts: [
      part('ability', 'performance', 0, 'skills'),
      part('ability', 'academics', 0, 'knowledges'),
    ],
  },
  {
    expected: {
      blocked: false,
      category: 'talents',
      penalty: 0,
    },
    isUnskilledKnowledgeAllowed: true,
    name: 'leaves a talent without a penalty when a knowledge at zero is allowed',
    parts: [
      part('ability', 'alertness', 0, 'talents'),
      part('ability', 'academics', 0, 'knowledges'),
    ],
  },
  {
    expected: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
    name: 'charges one skill penalty when two skills are at zero',
    parts: [
      part('ability', 'drive', 0, 'skills'),
      part('ability', 'performance', 0, 'skills'),
    ],
  },
  {
    expected: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
    name: 'applies the same skill penalty to a secondary ability',
    parts: [part('secondaryAbility', 'lockpicking', 0, 'skills')],
  },
  {
    expected: {
      blocked: true,
      category: 'knowledges',
      penalty: 0,
    },
    name: 'blocks a secondary knowledge at zero',
    parts: [part('secondaryAbility', 'theology', 0, 'knowledges')],
  },
  {
    expected: undefined,
    name: 'ignores a zero ability without a category',
    parts: [part('ability', 'alertness', 0)],
  },
];

const DIFFICULTY_CASES: DifficultyCase[] = [
  {
    declared: 6,
    expected: 6,
    name: 'keeps a declared difficulty without a penalty',
    penalty: 0,
  },
  {
    declared: 6,
    expected: 7,
    name: 'adds one to a declared difficulty',
    penalty: 1,
  },
  {
    declared: 9,
    expected: 10,
    name: 'raises nine to ten',
    penalty: 1,
  },
  {
    declared: 10,
    expected: 10,
    name: 'caps the penalty at ten',
    penalty: 1,
  },
  {
    declared: 3,
    expected: 4,
    name: 'raises the minimum difficulty by one',
    penalty: 1,
  },
];

const PENALTY_CASES: PenaltyCase[] = [
  {
    declared: 6,
    expected: false,
    name: 'hides the skill line when nothing is unskilled',
    unskilled: undefined,
  },
  {
    declared: 6,
    expected: false,
    name: 'hides the skill line for an unskilled talent',
    unskilled: {
      blocked: false,
      category: 'talents',
      penalty: 0,
    },
  },
  {
    declared: 6,
    expected: true,
    name: 'shows the skill line when difficulty actually rises',
    unskilled: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
  },
  {
    declared: 10,
    expected: false,
    name: 'hides the skill line when the penalty cannot raise difficulty',
    unskilled: {
      blocked: false,
      category: 'skills',
      penalty: 1,
    },
  },
  {
    declared: 6,
    expected: false,
    name: 'hides the skill line for a blocked knowledge',
    unskilled: {
      blocked: true,
      category: 'knowledges',
      penalty: 0,
    },
  },
];

describe('unskilled', () => {
  describe('resolveUnskilled', () => {
    it.each(UNSKILLED_CASES)('$name', ({ expected, isUnskilledKnowledgeAllowed, parts }) => {
      expect(resolveUnskilled(parts, isUnskilledKnowledgeAllowed)).toStrictEqual(expected);
    });

    it('defaults knowledge permission to blocked', () => {
      expect(resolveUnskilled([part('ability', 'academics', 0, 'knowledges')])).toStrictEqual(
        resolveUnskilled([part('ability', 'academics', 0, 'knowledges')], false),
      );
    });
  });

  describe('hasUnskilledKnowledge', () => {
    it('stays true when an allowed knowledge shares the pool with a skill', () => {
      const parts = [
        part('ability', 'performance', 0, 'skills'),
        part('ability', 'academics', 0, 'knowledges'),
      ];

      expect(hasUnskilledKnowledge(parts)).toBe(true);
      expect(resolveUnskilled(parts, true)?.category).toBe('skills');
    });

    it('is false when the pool has no knowledge at zero', () => {
      expect(hasUnskilledKnowledge([part('ability', 'performance', 0, 'skills')])).toBe(false);
    });
  });

  describe('effectiveDifficulty', () => {
    it.each(DIFFICULTY_CASES)('$name', ({ declared, expected, penalty }) => {
      expect(effectiveDifficulty(declared, penalty)).toBe(expected);
    });

    it('defaults the penalty to zero', () => {
      expect(effectiveDifficulty(6)).toBe(6);
    });
  });

  describe('shouldShowSkillPenalty', () => {
    it.each(PENALTY_CASES)('$name', ({ declared, expected, unskilled }) => {
      expect(shouldShowSkillPenalty(declared, unskilled)).toBe(expected);
    });
  });
});

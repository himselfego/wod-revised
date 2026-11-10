import { describe, expect, it } from 'vitest';

import { resolvePoolOutcome } from './outcome';

const CASES = [
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 6, hit: true, one: false }],
      successes: 1,
      verdict: 'success',
    },
    faces: [6],
    name: 'treats a face equal to difficulty as a hit',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 5, hit: false, one: false }],
      successes: 0,
      verdict: 'failure',
    },
    faces: [5],
    name: 'treats a face below difficulty as a miss',
    willSpendWillpower: false,
  },
  {
    difficulty: 3,
    expected: {
      dice: [{ face: 3, hit: true, one: false }],
      successes: 1,
      verdict: 'success',
    },
    faces: [3],
    name: 'treats a 3 as a hit at difficulty 3',
    willSpendWillpower: false,
  },
  {
    difficulty: 10,
    expected: {
      dice: [{ face: 10, hit: true, one: false }],
      successes: 1,
      verdict: 'success',
    },
    faces: [10],
    name: 'treats a 10 as a hit at difficulty 10',
    willSpendWillpower: false,
  },
  {
    difficulty: 10,
    expected: {
      dice: [{ face: 9, hit: false, one: false }],
      successes: 0,
      verdict: 'failure',
    },
    faces: [9],
    name: 'treats a 9 as a miss at difficulty 10',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 6, hit: true, one: false },
        { face: 8, hit: true, one: false },
        { face: 10, hit: true, one: false },
      ],
      successes: 3,
      verdict: 'success',
    },
    faces: [6, 8, 10],
    name: 'counts each hit as a success',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 10, hit: true, one: false }],
      successes: 1,
      verdict: 'success',
    },
    faces: [10],
    name: 'does not treat a 10 as a one',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 6, hit: true, one: false },
        { face: 8, hit: true, one: false },
      ],
      successes: 1,
      verdict: 'success',
    },
    faces: [1, 6, 8],
    name: 'subtracts ones from hits',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 1, hit: false, one: true },
        { face: 1, hit: false, one: true },
      ],
      successes: 0,
      verdict: 'botch',
    },
    faces: [1, 1, 1],
    name: 'cannot go below zero successes when ones exceed hits',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 6, hit: true, one: false },
      ],
      successes: 0,
      verdict: 'failure',
    },
    faces: [1, 6],
    name: 'is a failure when ones cancel all hits',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 1, hit: false, one: true },
        { face: 6, hit: true, one: false },
        { face: 7, hit: true, one: false },
      ],
      successes: 0,
      verdict: 'failure',
    },
    faces: [1, 1, 6, 7],
    name: 'is a failure when ones cancel extra hits',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 2, hit: false, one: false },
        { face: 3, hit: false, one: false },
        { face: 4, hit: false, one: false },
      ],
      successes: 0,
      verdict: 'failure',
    },
    faces: [2, 3, 4],
    name: 'is a failure when every face misses and none are ones',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 2, hit: false, one: false },
        { face: 3, hit: false, one: false },
      ],
      successes: 0,
      verdict: 'botch',
    },
    faces: [1, 2, 3],
    name: 'is a botch when there are ones and no hits',
    willSpendWillpower: false,
  },
  {
    difficulty: 3,
    expected: {
      dice: [{ face: 1, hit: false, one: true }],
      successes: 0,
      verdict: 'botch',
    },
    faces: [1],
    name: 'treats a one as a miss at difficulty 3',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 3, hit: false, one: false },
        { face: 6, hit: true, one: false },
        { face: 8, hit: true, one: false },
      ],
      successes: 2,
      verdict: 'success',
    },
    faces: [8, 3, 6],
    name: 'sorts faces ascending',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [],
      successes: 0,
      verdict: 'failure',
    },
    faces: [],
    name: 'is a failure for an empty pool',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 8, hit: true, one: false }],
      successes: 2,
      verdict: 'success',
    },
    faces: [8],
    name: 'adds one success after ones when willpower is spent',
    willSpendWillpower: true,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 6, hit: true, one: false },
      ],
      successes: 1,
      verdict: 'success',
    },
    faces: [1, 6],
    name: 'adds a willpower success after ones cancelled the dice',
    willSpendWillpower: true,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 2, hit: false, one: false },
      ],
      successes: 1,
      verdict: 'success',
    },
    faces: [1, 2],
    name: 'turns a botch into a success when willpower is spent',
    willSpendWillpower: true,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 2, hit: false, one: false },
        { face: 3, hit: false, one: false },
      ],
      successes: 1,
      verdict: 'success',
    },
    faces: [2, 3],
    name: 'turns a miss into a success when willpower is spent',
    willSpendWillpower: true,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 1, hit: false, one: true },
        { face: 1, hit: false, one: true },
      ],
      successes: 1,
      verdict: 'success',
    },
    faces: [1, 1, 1],
    name: 'does not let ones subtract the willpower success',
    willSpendWillpower: true,
  },
  {
    difficulty: 6,
    expected: {
      dice: [],
      successes: 1,
      verdict: 'success',
    },
    faces: [],
    name: 'gives one success for an empty pool when willpower is spent',
    willSpendWillpower: true,
  },
] as const;

describe('resolvePoolOutcome', () => {
  it.each(CASES)('$name', ({ difficulty, expected, faces, willSpendWillpower }) => {
    expect(resolvePoolOutcome(faces, difficulty, willSpendWillpower)).toStrictEqual({
      extraDice: [],
      ...expected,
    });
  });

  it('defaults willpower spending to false', () => {
    expect(resolvePoolOutcome([6], 6)).toStrictEqual(resolvePoolOutcome([6], 6, false));
  });
});

const EXTRA_CASES = [
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 10, hit: true, one: false }],
      extraDice: [{ face: 8, hit: true, one: false }],
      successes: 2,
      verdict: 'success',
    },
    extraFaces: [8],
    faces: [10],
    name: 'adds a specialization reroll hit',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 10, hit: true, one: false }],
      extraDice: [
        { face: 6, hit: true, one: false },
        { face: 10, hit: true, one: false },
      ],
      successes: 3,
      verdict: 'success',
    },
    extraFaces: [10, 6],
    faces: [10],
    name: 'counts chained tens on specialization rerolls',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [{ face: 10, hit: true, one: false }],
      extraDice: [{ face: 1, hit: false, one: false }],
      successes: 1,
      verdict: 'success',
    },
    extraFaces: [1],
    faces: [10],
    name: 'treats a one on a specialization reroll as a blank',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 10, hit: true, one: false },
      ],
      extraDice: [{ face: 1, hit: false, one: false }],
      successes: 0,
      verdict: 'failure',
    },
    extraFaces: [1],
    faces: [10, 1],
    name: 'does not let a specialization reroll one cancel or botch',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 10, hit: true, one: false },
      ],
      extraDice: [{ face: 8, hit: true, one: false }],
      successes: 1,
      verdict: 'success',
    },
    extraFaces: [8],
    faces: [10, 1],
    name: 'lets a specialization reroll save a cancelled ten',
    willSpendWillpower: false,
  },
  {
    difficulty: 6,
    expected: {
      dice: [
        { face: 1, hit: false, one: true },
        { face: 10, hit: true, one: false },
      ],
      extraDice: [{ face: 1, hit: false, one: false }],
      successes: 1,
      verdict: 'success',
    },
    extraFaces: [1],
    faces: [10, 1],
    name: 'still adds willpower after blank specialization ones',
    willSpendWillpower: true,
  },
] as const;

describe('resolvePoolOutcome specialization extras', () => {
  it.each(EXTRA_CASES)('$name', ({ difficulty, expected, extraFaces, faces, willSpendWillpower }) => {
    expect(resolvePoolOutcome(faces, difficulty, willSpendWillpower, extraFaces)).toStrictEqual(expected);
  });

  it('defaults extra faces to none', () => {
    expect(resolvePoolOutcome([10], 6, false)).toStrictEqual(resolvePoolOutcome([10], 6, false, []));
  });
});

describe('resolvePoolOutcome automatic successes', () => {
  it('adds them after ones cancel hits', () => {
    expect(resolvePoolOutcome([1, 7], 6, false, [], 2)).toMatchObject({ successes: 2, verdict: 'success' });
  });

  it('turns a would-be botch into a success, like willpower', () => {
    expect(resolvePoolOutcome([1, 2], 6, false, [], 1)).toMatchObject({ successes: 1, verdict: 'success' });
  });

  it('stacks with willpower', () => {
    expect(resolvePoolOutcome([5], 6, true, [], 1).successes).toBe(2);
  });
});

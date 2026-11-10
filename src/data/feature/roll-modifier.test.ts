import { describe, expect, it } from 'vitest';

import { isRollTarget, partTargets, readRollModifiers } from './roll-modifier';

describe('isRollTarget', () => {
  it.each([
    'any',
    'attribute:strength',
    'attributeGroup:social',
    'ability:leadership',
    'abilityCategory:knowledges',
    'virtue:courage',
    'willpower:willpower',
    'humanity:humanity',
  ])('accepts %s', (target) => {
    expect(isRollTarget(target)).toBe(true);
  });

  it.each(['', 'attribute', 'attribute:', 'attribute:luck', 'secondaryAbility:abc', 'willpower:x', 42])(
    'rejects %s',
    (target) => {
      expect(isRollTarget(target)).toBe(false);
    },
  );
});

describe('partTargets', () => {
  it('matches an attribute, its group and any roll', () => {
    expect(partTargets({ id: 'charisma', kind: 'attribute' })).toStrictEqual([
      'any',
      'attribute:charisma',
      'attributeGroup:social',
    ]);
  });

  it('matches an ability and its category', () => {
    expect(partTargets({ category: 'talents', id: 'leadership', kind: 'ability' })).toStrictEqual([
      'any',
      'ability:leadership',
      'abilityCategory:talents',
    ]);
  });

  it('matches a secondary ability only through its category', () => {
    expect(partTargets({ category: 'skills', id: 'item123', kind: 'secondaryAbility' })).toStrictEqual([
      'any',
      'abilityCategory:skills',
    ]);
  });
});

describe('readRollModifiers', () => {
  it('clamps numbers and drops unknown and repeated targets', () => {
    expect(readRollModifiers([{
      dice: '15',
      difficulty: -9,
      ignoreWounds: true,
      setDifficulty: '12',
      successes: 2.6,
      targets: ['ability:leadership', 'nope', 'ability:leadership'],
      variable: '9',
    }])).toStrictEqual([{
      dice: 10,
      difficulty: -5,
      ignoreWounds: true,
      setDifficulty: 10,
      successes: 3,
      targets: ['ability:leadership'],
      variable: 5,
    }]);
  });

  it('turns options off for blank or too small values', () => {
    const [modifier] = readRollModifiers([{ setDifficulty: '', targets: [], variable: 1 }]);

    expect(modifier).toMatchObject({ dice: 0, setDifficulty: 0, successes: 0, variable: 0 });
    expect(readRollModifiers([{ setDifficulty: 2 }])[0]?.setDifficulty).toBe(0);
  });

  it('reads an object with numeric keys, as a form submits it', () => {
    expect(readRollModifiers({ 0: { dice: 1, targets: { 0: 'any' } } })).toStrictEqual([{
      dice: 1,
      difficulty: 0,
      ignoreWounds: false,
      setDifficulty: 0,
      successes: 0,
      targets: ['any'],
      variable: 0,
    }]);
  });

  it('skips non-objects', () => {
    expect(readRollModifiers(['x', null, 3])).toStrictEqual([]);
    expect(readRollModifiers(undefined)).toStrictEqual([]);
  });
});

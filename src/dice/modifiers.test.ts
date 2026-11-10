import type { RollModifier } from '../data/feature/roll-modifier';

import find from 'lodash/find';
import map from 'lodash/map';
import some from 'lodash/some';
import { describe, expect, it } from 'vitest';

import { modifierChoices, modifierTotals, resolveActiveModifiers } from './modifiers';

const rollModifier = (patch: Partial<RollModifier>): RollModifier => ({
  dice: 0,
  difficulty: 0,
  ignoreWounds: false,
  setDifficulty: 0,
  successes: 0,
  targets: [],
  variable: 0,
  ...patch,
});

const ITEMS = [
  {
    id: 'lead',
    name: 'Прирожденный лидер',
    system: { modifiers: [rollModifier({ difficulty: -3, targets: ['ability:leadership'] })] },
  },
  {
    id: 'ki',
    name: 'Поток Ки',
    system: { modifiers: [rollModifier({ difficulty: -1, targets: ['attributeGroup:physical'], variable: 3 })] },
  },
  {
    id: 'calm',
    name: 'Отстраненность',
    system: { modifiers: [rollModifier({ ignoreWounds: true, targets: ['any'] })] },
  },
  { id: 'plain', name: 'Без модификаторов', system: {} },
];

const CHARISMA = { id: 'charisma', kind: 'attribute' };
const LEADERSHIP = { category: 'talents' as const, id: 'leadership', kind: 'ability' };

describe('modifierChoices', () => {
  it('lists modifiers of all items by name and marks the ones matching the pool', () => {
    const choices = modifierChoices(ITEMS, [CHARISMA, LEADERSHIP]);

    expect(map(choices, choice => [choice.key, choice.relevant])).toStrictEqual([
      ['calm:0', true],
      ['ki:0', false],
      ['lead:0', true],
    ]);
  });

  it('matches an attribute group with an attribute from it', () => {
    const choices = modifierChoices(ITEMS, [{ id: 'dexterity', kind: 'attribute' }]);

    expect(find(choices, ['key', 'ki:0'])?.relevant).toBe(true);
  });

  it('matches nothing for an empty pool, not even any roll', () => {
    expect(some(modifierChoices(ITEMS, []), 'relevant')).toBe(false);
  });
});

describe('resolveActiveModifiers', () => {
  const choices = modifierChoices(ITEMS, [CHARISMA]);

  it('keeps only selected modifiers and multiplies a variable amount', () => {
    const active = resolveActiveModifiers(choices, new Map([['ki:0', 2], ['lead:0', 1]]));

    expect(active).toStrictEqual([
      expect.objectContaining({ difficulty: -2, label: 'Поток Ки' }),
      expect.objectContaining({ difficulty: -3, label: 'Прирожденный лидер' }),
    ]);
  });

  it('clamps a variable amount to 1…N and ignores it for fixed modifiers', () => {
    expect(resolveActiveModifiers(choices, new Map([['ki:0', 9]]))[0]?.difficulty).toBe(-3);
    expect(resolveActiveModifiers(choices, new Map([['ki:0', 0]]))[0]?.difficulty).toBe(-1);
    expect(resolveActiveModifiers(choices, new Map([['lead:0', 5]]))[0]?.difficulty).toBe(-3);
  });

  it('skips keys of items that are gone', () => {
    expect(resolveActiveModifiers(choices, new Map([['gone:0', 1]]))).toStrictEqual([]);
  });
});

describe('modifierTotals', () => {
  it('sums numbers and keeps the highest difficulty override', () => {
    const totals = modifierTotals([
      { dice: 2, difficulty: -1, ignoreWounds: false, label: 'A', setDifficulty: 6, successes: 1 },
      { dice: -1, difficulty: 2, ignoreWounds: true, label: 'B', setDifficulty: 8, successes: 0 },
    ]);

    expect(totals).toMatchObject({ dice: 1, difficulty: 1, ignoreWounds: true, successes: 1 });
    expect(totals.setDifficulty?.label).toBe('B');
  });

  it('is all zero without modifiers', () => {
    expect(modifierTotals([])).toStrictEqual({
      dice: 0,
      difficulty: 0,
      ignoreWounds: false,
      setDifficulty: undefined,
      successes: 0,
    });
  });
});

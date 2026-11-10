import type { RollModifier, TargetablePart } from '../data/feature/roll-modifier';

import clamp from 'lodash/clamp';
import filter from 'lodash/filter';
import flatMap from 'lodash/flatMap';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import maxBy from 'lodash/maxBy';
import some from 'lodash/some';
import sortBy from 'lodash/sortBy';
import sumBy from 'lodash/sumBy';
import toLower from 'lodash/toLower';

import { partTargets } from '../data/feature/roll-modifier';

/**
 * Модификатор, включённый на этот бросок, с уже применённой величиной.
 */
interface ActiveModifier {
  dice: number;
  difficulty: number;
  ignoreWounds: boolean;
  label: string;
  setDifficulty: number;
  successes: number;
}

interface ModifierChoice {
  key: string;
  label: string;
  modifier: RollModifier;
  relevant: boolean;
}

interface ModifierSource {
  id: string;
  name: string;
  system: { modifiers?: readonly RollModifier[] };
}

interface ModifierTotals {
  dice: number;
  difficulty: number;
  ignoreWounds: boolean;
  setDifficulty: ActiveModifier | undefined;
  successes: number;
}

/**
 * Все модификаторы с предметов персонажа; `relevant` — цель совпала хоть с одной частью пула.
 */
const modifierChoices = (
  items: readonly ModifierSource[],
  parts: readonly TargetablePart[],
): ModifierChoice[] => {
  const tags = new Set(flatMap(parts, partTargets));

  return flatMap(sortBy(items, item => toLower(item.name)), item => map(
    item.system.modifiers ?? [],
    (modifier, index) => ({
      key: `${item.id}:${index}`,
      label: item.name,
      modifier,
      relevant: !isEmpty(parts) && some(modifier.targets, target => tags.has(target)),
    }),
  ));
};

/**
 * Величина переменного модификатора в [1, variable]; у обычного всегда 1.
 */
const modifierAmount = (modifier: RollModifier, requested: number | undefined): number => (
  modifier.variable > 0 ? clamp(Math.round(requested ?? 1), 1, modifier.variable) : 1
);

const resolveActiveModifiers = (
  choices: readonly ModifierChoice[],
  selection: ReadonlyMap<string, number>,
): ActiveModifier[] => map(
  filter(choices, choice => selection.has(choice.key)),
  ({ key, label, modifier }) => {
    const amount = modifierAmount(modifier, selection.get(key));

    return {
      dice: modifier.dice * amount,
      difficulty: modifier.difficulty * amount,
      ignoreWounds: modifier.ignoreWounds,
      label,
      setDifficulty: modifier.setDifficulty,
      successes: modifier.successes * amount,
    };
  },
);

/**
 * Сумма включённых модификаторов. Из нескольких «сложность = N» берётся наибольшая.
 */
const modifierTotals = (active: readonly ActiveModifier[]): ModifierTotals => ({
  dice: sumBy(active, 'dice'),
  difficulty: sumBy(active, 'difficulty'),
  ignoreWounds: some(active, 'ignoreWounds'),
  setDifficulty: maxBy(filter(active, modifier => modifier.setDifficulty > 0), 'setDifficulty'),
  successes: sumBy(active, 'successes'),
});

export type {
  ActiveModifier,
  ModifierChoice,
  ModifierSource,
  ModifierTotals,
};
export {
  modifierAmount,
  modifierChoices,
  modifierTotals,
  resolveActiveModifiers,
};

import type { RollModifier } from '../data/feature/roll-modifier';

import compact from 'lodash/compact';
import constant from 'lodash/constant';
import isEmpty from 'lodash/isEmpty';
import join from 'lodash/join';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';
import toLower from 'lodash/toLower';

import {
  ABILITY_CATEGORY_ORDER,
  activeAbilitySet,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_IDS,
  VIRTUE_IDS,
} from '../config';
import { ANY_TARGET } from '../data/feature/roll-modifier';

interface TargetGroup {
  label: string;
  options: TargetOption[];
}

interface TargetOption {
  id: string;
  label: string;
}

const MINUS = '−';

const LABEL_KEYS: Record<string, (id: string) => string> = {
  humanity: constant('WOD.Field.humanity'),
  willpower: constant('WOD.Field.willpower'),
  ability: id => `WOD.Ability.${id}`,
  abilityCategory: id => `WOD.Modifier.abilityCategory.${id}`,
  attribute: id => `WOD.Attribute.${id}`,
  attributeGroup: id => `WOD.Modifier.attributeGroup.${id}`,
  virtue: id => `WOD.Virtue.${id}`,
};

const signed = (value: number): string => (value > 0 ? `+${value}` : `${MINUS}${Math.abs(value)}`);

const targetLabel = (target: string): string => {
  if (target === ANY_TARGET) {
    return game.i18n.localize('WOD.Modifier.any');
  }

  const separator = target.indexOf(':');
  const keyOf = LABEL_KEYS[target.slice(0, separator)];

  return keyOf ? game.i18n.localize(keyOf(target.slice(separator + 1))) : target;
};

const modifierTargetsText = (modifier: RollModifier): string => (
  isEmpty(modifier.targets)
    ? game.i18n.localize('WOD.Modifier.noTargets')
    : join(map(modifier.targets, targetLabel), ', ')
);

/**
 * «+2к, −3 сл.» — эффект при данной величине переменного модификатора.
 */
const effectTerm = (value: number, key: string, shown: number | string): string | undefined => (
  value === 0 ? undefined : game.i18n.format(key, { n: shown })
);

const modifierEffect = (modifier: RollModifier, amount = 1): string => {
  const parts = compact([
    effectTerm(modifier.dice, 'WOD.Modifier.diceShort', signed(modifier.dice * amount)),
    effectTerm(modifier.difficulty, 'WOD.Modifier.difficultyShort', signed(modifier.difficulty * amount)),
    effectTerm(modifier.successes, 'WOD.Modifier.successesShort', modifier.successes * amount),
    effectTerm(modifier.setDifficulty, 'WOD.Modifier.setDifficultyShort', modifier.setDifficulty),
    modifier.ignoreWounds ? game.i18n.localize('WOD.Modifier.ignoreWoundsShort') : undefined,
  ]);
  const effect = isEmpty(parts) ? game.i18n.localize('WOD.Modifier.noEffect') : join(parts, ', ');

  if (modifier.variable === 0) {
    return effect;
  }

  return `${effect} (${game.i18n.format('WOD.Modifier.upTo', { n: modifier.variable })})`;
};

/**
 * «Лидерство · −3 сл.» — строка для диалога и листа без права правки.
 */
const modifierSummary = (modifier: RollModifier, amount = 1): string => (
  `${modifierTargetsText(modifier)} · ${modifierEffect(modifier, amount)}`
);

const option = (id: string): TargetOption => ({ id, label: targetLabel(id) });

/**
 * Цели для выпадающего списка: общие, атрибуты, способности по категориям, душа.
 */
const targetGroups = (): TargetGroup[] => {
  const set = activeAbilitySet();

  return [
    { label: game.i18n.localize('WOD.Modifier.group.common'), options: [option(ANY_TARGET)] },
    {
      label: game.i18n.localize('WOD.Section.attributes'),
      options: [
        ...map(ATTRIBUTE_GROUP_ORDER, group => option(`attributeGroup:${group}`)),
        ...map(ATTRIBUTE_IDS, id => option(`attribute:${id}`)),
      ],
    },
    ...map(ABILITY_CATEGORY_ORDER, category => ({
      label: game.i18n.localize(`WOD.AbilityCategory.${category}`),
      options: [
        option(`abilityCategory:${category}`),
        ...sortBy(map(set[category], id => option(`ability:${id}`)), entry => toLower(entry.label)),
      ],
    })),
    {
      label: game.i18n.localize('WOD.Modifier.group.soul'),
      options: [
        ...map(VIRTUE_IDS, id => option(`virtue:${id}`)),
        option('willpower:willpower'),
        option('humanity:humanity'),
      ],
    },
  ];
};

export type {
  TargetGroup,
  TargetOption,
};
export {
  modifierEffect,
  modifierSummary,
  modifierTargetsText,
  targetGroups,
  targetLabel,
};

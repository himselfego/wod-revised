import type { AbilityCategory } from '../../config';

import clamp from 'lodash/clamp';
import compact from 'lodash/compact';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import isArray from 'lodash/isArray';
import isFinite from 'lodash/isFinite';
import isString from 'lodash/isString';
import map from 'lodash/map';
import uniq from 'lodash/uniq';
import values from 'lodash/values';

import {
  ABILITY_CATEGORY_ORDER,
  ABILITY_IDS,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_IDS,
  attributeGroupOf,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  VIRTUE_IDS,
} from '../../config';
import { isRecord } from '../../guards';

/**
 * Модификатор броска на черте. Игрок включает его в диалоге сам;
 * цели только подсказывают, к каким пулам он подходит.
 * `setDifficulty` и `variable`: 0 — выключено.
 */
interface RollModifier {
  dice: number;
  difficulty: number;
  ignoreWounds: boolean;
  setDifficulty: number;
  successes: number;
  targets: string[];
  variable: number;
}

const ROLL_MODIFIER_LIMITS = {
  dice: 10,
  difficulty: 5,
  successes: 5,
  variable: 5,
} as const;

const ANY_TARGET = 'any';

/**
 * Цели вида `вид:id`; отдельные характеристики совпадают с ключами пула.
 */
const TARGET_IDS: Record<string, readonly string[]> = {
  ability: ABILITY_IDS,
  abilityCategory: ABILITY_CATEGORY_ORDER,
  attribute: ATTRIBUTE_IDS,
  attributeGroup: ATTRIBUTE_GROUP_ORDER,
  humanity: ['humanity'],
  virtue: VIRTUE_IDS,
  willpower: ['willpower'],
};

const isRollTarget = (value: unknown): value is string => {
  if (!isString(value)) {
    return false;
  }

  if (value === ANY_TARGET) {
    return true;
  }

  const separator = value.indexOf(':');
  const ids = TARGET_IDS[value.slice(0, separator)];

  return separator > 0 && isArray(ids) && includes(ids, value.slice(separator + 1));
};

interface TargetablePart {
  category?: AbilityCategory;
  id: string;
  kind: string;
}

/**
 * Какие цели модификаторов подходят к части пула. Вторичная способность — только через свою категорию.
 */
const partTargets = (part: TargetablePart): string[] => {
  const group = part.kind === 'attribute' ? attributeGroupOf(part.id) : undefined;

  return compact([
    ANY_TARGET,
    part.kind === 'secondaryAbility' ? undefined : `${part.kind}:${part.id}`,
    group ? `attributeGroup:${group}` : undefined,
    part.category ? `abilityCategory:${part.category}` : undefined,
  ]);
};

const intOf = (value: unknown): number => {
  const next = Math.round(Number(value));

  return isFinite(next) ? next : 0;
};

/**
 * 0 или значение в [min, max]: пустое поле, мусор и всё ниже `min` выключают опцию.
 */
const optionalInt = (value: unknown, min: number, max: number): number => {
  const next = intOf(value);

  return next < min ? 0 : Math.min(next, max);
};

const readRollModifier = (entry: Record<string, unknown>): RollModifier => {
  const { dice, difficulty, ignoreWounds, setDifficulty, successes, targets, variable } = entry;
  const rawTargets = isArray(targets) ? targets : (isRecord(targets) ? values(targets) : []);

  return {
    dice: clamp(intOf(dice), -ROLL_MODIFIER_LIMITS.dice, ROLL_MODIFIER_LIMITS.dice),
    difficulty: clamp(intOf(difficulty), -ROLL_MODIFIER_LIMITS.difficulty, ROLL_MODIFIER_LIMITS.difficulty),
    ignoreWounds: ignoreWounds === true,
    setDifficulty: optionalInt(setDifficulty, DIFFICULTY_MIN, DIFFICULTY_MAX),
    successes: clamp(intOf(successes), 0, ROLL_MODIFIER_LIMITS.successes),
    targets: uniq(filter(rawTargets, isRollTarget)),
    variable: optionalInt(variable, 2, ROLL_MODIFIER_LIMITS.variable),
  };
};

/**
 * Очищает модификаторы из формы или старых данных: числа зажаты, неизвестные цели отброшены.
 */
const readRollModifiers = (value: unknown): RollModifier[] => {
  const entries = isArray(value) ? value : (isRecord(value) ? values(value) : []);

  return map(filter(entries, isRecord), readRollModifier);
};

/**
 * Поле схемы. Поля Foundry берутся при вызове, чтобы модуль импортировался в тестах.
 */
const rollModifiersField = (): object => {
  const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;
  const int = (min: number, max: number): object => new NumberField({
    initial: 0,
    integer: true,
    max,
    min,
    required: true,
  });

  return new ArrayField(new SchemaField({
    dice: int(-ROLL_MODIFIER_LIMITS.dice, ROLL_MODIFIER_LIMITS.dice),
    difficulty: int(-ROLL_MODIFIER_LIMITS.difficulty, ROLL_MODIFIER_LIMITS.difficulty),
    ignoreWounds: new BooleanField({ initial: false, required: true }),
    setDifficulty: int(0, DIFFICULTY_MAX),
    successes: int(0, ROLL_MODIFIER_LIMITS.successes),
    targets: new ArrayField(new StringField({ blank: false, required: true }), { initial: [], required: true }),
    variable: int(0, ROLL_MODIFIER_LIMITS.variable),
  }), { initial: [], required: true });
};

export type {
  RollModifier,
  TargetablePart,
};
export {
  ANY_TARGET,
  isRollTarget,
  partTargets,
  readRollModifiers,
  ROLL_MODIFIER_LIMITS,
  rollModifiersField,
};

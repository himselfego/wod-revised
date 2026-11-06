import concat from 'lodash/concat';
import constant from 'lodash/constant';
import filter from 'lodash/filter';
import find from 'lodash/find';
import flatMap from 'lodash/flatMap';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import keys from 'lodash/keys';
import sortBy from 'lodash/sortBy';
import take from 'lodash/take';
import takeRight from 'lodash/takeRight';
import times from 'lodash/times';
import uniq from 'lodash/uniq';

const ABILITY_CATEGORY_ORDER = ['talents', 'skills', 'knowledges'] as const;

type AbilityCategory = (typeof ABILITY_CATEGORY_ORDER)[number];

const isAbilityCategory = (value: unknown): value is AbilityCategory => includes(
  ABILITY_CATEGORY_ORDER as readonly unknown[],
  value,
);

const ABILITY_SET_IDS = ['revised-modern', 'dark-ages'] as const;

interface AbilitySet {
  id: AbilitySetId;
  knowledges: readonly string[];
  skills: readonly string[];
  talents: readonly string[];
}

type AbilitySetId = (typeof ABILITY_SET_IDS)[number];

/**
 * Наборы способностей — данные, не типы актора.
 * Значения лежат на акторе по id; лист показывает текущий набор.
 *
 * revised-modern: Vampire / core WoD Revised (Dodge, Security, Linguistics).
 * dark-ages: Dark Ages Vampire, базовый 10/10/10.
 */
const ABILITY_SETS: Record<AbilitySetId, AbilitySet> = {
  'dark-ages': {
    id: 'dark-ages',
    knowledges: [
      'academics',
      'hearthWisdom',
      'investigation',
      'law',
      'linguistics',
      'medicine',
      'occult',
      'politics',
      'seneschal',
      'theology',
    ],
    skills: [
      'animalKen',
      'archery',
      'commerce',
      'crafts',
      'etiquette',
      'melee',
      'performance',
      'ride',
      'stealth',
      'survival',
    ],
    talents: [
      'alertness',
      'athletics',
      'brawl',
      'dodge',
      'empathy',
      'expression',
      'intimidation',
      'leadership',
      'legerdemain',
      'subterfuge',
    ],
  },
  'revised-modern': {
    id: 'revised-modern',
    knowledges: [
      'academics',
      'computer',
      'finance',
      'investigation',
      'law',
      'linguistics',
      'medicine',
      'occult',
      'politics',
      'science',
    ],
    skills: [
      'animalKen',
      'crafts',
      'drive',
      'etiquette',
      'firearms',
      'melee',
      'performance',
      'security',
      'stealth',
      'survival',
    ],
    talents: [
      'alertness',
      'athletics',
      'brawl',
      'dodge',
      'empathy',
      'expression',
      'intimidation',
      'leadership',
      'streetwise',
      'subterfuge',
    ],
  },
};

const ABILITY_IDS = sortBy(
  uniq(flatMap(ABILITY_SETS, set => concat(set.knowledges, set.skills, set.talents))),
);

/**
 * Атрибуты — общий блок схемы, не наборы как способности.
 * В Revised / Dark Ages у всех игровых сплатов одна девятка:
 * Strength, Dexterity, Stamina / Charisma, Manipulation, Appearance /
 * Perception, Intelligence, Wits.
 *
 * Не путать с 5ed (Appearance → Composure, Perception → Resolve) —
 * это мировая настройка, не сплат. Духи и тень призрака девятку
 * не показывают (Rage/Gnosis/Willpower или отдельный лист), список
 * полей от этого не меняется. У перевертышей те же 9, формы дают
 * бонусы; у вампира может расти max.
 */
const ATTRIBUTE_GROUP_ORDER = ['physical', 'social', 'mental'] as const;

type AttributeGroup = (typeof ATTRIBUTE_GROUP_ORDER)[number];

const ATTRIBUTE_GROUPS = {
  mental: ['perception', 'intelligence', 'wits'],
  physical: ['strength', 'dexterity', 'stamina'],
  social: ['charisma', 'manipulation', 'appearance'],
} as const;

const ATTRIBUTE_IDS = flatMap(ATTRIBUTE_GROUP_ORDER, group => ATTRIBUTE_GROUPS[group]);

/**
 * Добродетели Пути Человечности. Conviction / Instinct — позже, с Путём.
 */
const VIRTUE_IDS = ['conscience', 'selfControl', 'courage'] as const;

type VirtueId = (typeof VIRTUE_IDS)[number];

const isAttributeKey = (value: unknown): value is string => includes(
  ATTRIBUTE_IDS as readonly unknown[],
  value,
);

const attributeGroupOf = (key: string): AttributeGroup | undefined => find(
  ATTRIBUTE_GROUP_ORDER,
  group => includes(ATTRIBUTE_GROUPS[group], key),
);

/**
 * Пока переключатель набора заморожен и мировой настройки нет.
 * Когда набор станет мировой настройкой — меняется эта функция.
 */
const DEFAULT_ABILITY_SET_ID: AbilitySetId = 'revised-modern';

const activeAbilitySetId = (): AbilitySetId => DEFAULT_ABILITY_SET_ID;

const activeAbilitySet = (): AbilitySet => ABILITY_SETS[activeAbilitySetId()];

const abilityCategoryOf = (
  abilityId: string,
  setId: AbilitySetId = activeAbilitySetId(),
): AbilityCategory | undefined => {
  const set = ABILITY_SETS[setId];

  return find(ABILITY_CATEGORY_ORDER, category => includes(set[category], abilityId));
};

const SPECIALIZATION_TARGET_KINDS = ['attribute', 'ability', 'secondaryAbility'] as const;

type SpecializationTargetKind = (typeof SPECIALIZATION_TARGET_KINDS)[number];

const isSpecializationTargetKind = (value: unknown): value is SpecializationTargetKind => includes(
  SPECIALIZATION_TARGET_KINDS as readonly unknown[],
  value,
);

const parseSpecializationTarget = (
  value: unknown,
): { targetId: string; targetKind: SpecializationTargetKind } | undefined => {
  if (!isString(value)) {
    return undefined;
  }

  const separator = value.indexOf(':');

  if (separator <= 0) {
    return undefined;
  }

  const targetKind = value.slice(0, separator);
  const targetId = value.slice(separator + 1);

  if (!isSpecializationTargetKind(targetKind) || isEmpty(targetId)) {
    return undefined;
  }

  return { targetId, targetKind };
};

interface SpecializationHost {
  items?: {
    get: (id: string) => { system: { category?: string } } | undefined;
  };
  system?: {
    abilitySet?: AbilitySetId;
  };
}

const specializationArtworkCategory = (
  targetKind: string | undefined,
  targetId: string | undefined,
  host?: SpecializationHost,
): string | undefined => {
  if (targetKind === 'attribute' && isString(targetId)) {
    return attributeGroupOf(targetId);
  }

  if (targetKind === 'ability' && isString(targetId)) {
    return abilityCategoryOf(targetId, host?.system?.abilitySet ?? activeAbilitySetId());
  }

  if (targetKind === 'secondaryAbility' && isString(targetId)) {
    const category = host?.items?.get(targetId)?.system.category;

    if (isAbilityCategory(category)) {
      return category;
    }

    return 'talents';
  }

  return undefined;
};

const DAMAGE_CYCLE = ['', 'bashing', 'lethal', 'aggravated'] as const;

type DamageState = (typeof DAMAGE_CYCLE)[number];

const COST_MAX = 7;

const COST_MIN = 1;

const DEFAULT_ACTOR_IMG = 'icons/svg/mystery-man.svg';

const HEALTH_LEVELS = [
  { id: 'bruised', penalty: 0 },
  { id: 'hurt', penalty: 1 },
  { id: 'injured', penalty: 1 },
  { id: 'wounded', penalty: 2 },
  { id: 'mauled', penalty: 2 },
  { id: 'crippled', penalty: 5 },
  { id: 'incapacitated' },
] as const;

const HEALTH_ICON = 'fa-solid fa-heart';

const MONEY_ICON = 'fa-solid fa-dollar-sign';

const WILLPOWER_ICON = 'fa-solid fa-candle-holder';

const packWoundBoxes = (boxes: readonly string[]): DamageState[] => {
  const aggravated = filter(boxes, (value): value is 'aggravated' => value === 'aggravated');
  const bashing = filter(boxes, (value): value is 'bashing' => value === 'bashing');
  const lethal = filter(boxes, (value): value is 'lethal' => value === 'lethal');
  const packed = take(concat(aggravated, lethal, bashing), HEALTH_LEVELS.length);
  const empty = times(HEALTH_LEVELS.length - packed.length, constant<DamageState>(''));

  return concat(packed, empty);
};

const isPainHealthLevel = (level: (typeof HEALTH_LEVELS)[number]): boolean => (
  !('penalty' in level) || level.penalty > 0
);

const PAIN_BOX_COUNT = filter(HEALTH_LEVELS, isPainHealthLevel).length;

/**
 * 0…1 красной виньетки портрета. С конца трека: боль (Hurt…Incapacitated).
 * Bruised и бонусные клетки слева (Huge Size и т.п.) не красят.
 */
const woundVignette = (boxes: readonly string[]): number => {
  const filled = filter(takeRight(boxes, PAIN_BOX_COUNT), box => !isEmpty(box)).length;

  return filled / PAIN_BOX_COUNT;
};

const MERIT_FLAW_TYPE_ORDER = ['merit', 'flaw'] as const;

type MeritFlawType = (typeof MERIT_FLAW_TYPE_ORDER)[number];

const MERIT_FLAW_IMG = {
  flaw: 'icons/svg/downgrade.svg',
  merit: 'icons/svg/upgrade.svg',
} as const;

/**
 * Вторичные: талант / навык / познание. Не путать с merit/flaw (тип, не категория).
 */
const SECONDARY_ABILITY_IMG = {
  knowledges: 'icons/svg/book.svg',
  skills: 'icons/svg/sword.svg',
  talents: 'icons/svg/wing.svg',
} as const;

const SPECIALIZATION_IMG = {
  knowledges: SECONDARY_ABILITY_IMG.knowledges,
  mental: 'icons/svg/daze.svg',
  physical: 'icons/svg/combat.svg',
  skills: SECONDARY_ABILITY_IMG.skills,
  social: 'icons/svg/sound.svg',
  talents: SECONDARY_ABILITY_IMG.talents,
} as const;

const isSpecializationImgCategory = (
  value: string | undefined,
): value is keyof typeof SPECIALIZATION_IMG => isString(value) && includes(keys(SPECIALIZATION_IMG), value);

const itemImg = (type: string | undefined, category?: string): string | undefined => {
  if (type === 'secondaryAbility') {
    if (isAbilityCategory(category)) {
      return SECONDARY_ABILITY_IMG[category];
    }

    return SECONDARY_ABILITY_IMG.talents;
  }

  if (type === 'specialization') {
    if (isSpecializationImgCategory(category)) {
      return SPECIALIZATION_IMG[category];
    }

    return SPECIALIZATION_IMG.physical;
  }

  if (type === 'flaw' || type === 'merit') {
    return MERIT_FLAW_IMG[type];
  }

  return undefined;
};

const MERIT_FLAW_CATEGORY_ORDER = ['physical', 'mental', 'social', 'supernatural'] as const;

type MeritFlawCategory = (typeof MERIT_FLAW_CATEGORY_ORDER)[number];

/**
 * Лестничные силы: нумины, позже дисциплины / искусства / хекау.
 * Не дары, не ритуалы, не сферы, не царства.
 */
const POWER_FAMILY_ORDER = ['numina'] as const;

type PowerFamily = (typeof POWER_FAMILY_ORDER)[number];

const isPowerFamily = (value: unknown): value is PowerFamily => includes(
  POWER_FAMILY_ORDER as readonly unknown[],
  value,
);

/**
 * Человеческий потолок трейта. Выше — только модификатор на персонаже
 * (поколение вампира и т.п.).
 */
const TRAIT_MAX = 5;

/**
 * Книжный потолок фичи по умолчанию (сила, дополнение). Не `TRAIT_MAX`:
 * у предмета свой `max`, часто 5, иногда 10+.
 */
const FEATURE_MAX_INITIAL = 5;

/**
 * Revised: специализация обязательна при рейтинге 4+.
 */
const SPECIALIZATION_MIN_RATING = 4;

const WILLPOWER_MAX = 10;

/**
 * Человечность / рейтинг Пути. Нуль — зверь; средний смертный — 7.
 */
const HUMANITY_MAX = 10;

const DIFFICULTY_MIN = 3;

const DIFFICULTY_MAX = 10;

const DIFFICULTY_DEFAULT = 6;

const DIFFICULTIES = times(
  DIFFICULTY_MAX - DIFFICULTY_MIN + 1,
  offset => offset + DIFFICULTY_MIN,
);

const isDifficulty = (value: unknown): value is number => includes(DIFFICULTIES, value);

const WOD = {
  abilityCategories: ABILITY_CATEGORY_ORDER,
  abilitySets: ABILITY_SETS,
  attributeGroups: ATTRIBUTE_GROUPS,
  cost: { max: COST_MAX, min: COST_MIN },
  healthLevels: HEALTH_LEVELS,
  meritFlawCategories: MERIT_FLAW_CATEGORY_ORDER,
  meritFlawTypes: MERIT_FLAW_TYPE_ORDER,
  powerFamilies: POWER_FAMILY_ORDER,
} as const;

export type {
  AbilityCategory,
  AbilitySet,
  AbilitySetId,
  AttributeGroup,
  DamageState,
  MeritFlawCategory,
  MeritFlawType,
  PowerFamily,
  SpecializationHost,
  SpecializationTargetKind,
  VirtueId,
};
export {
  ABILITY_CATEGORY_ORDER,
  ABILITY_IDS,
  ABILITY_SET_IDS,
  ABILITY_SETS,
  abilityCategoryOf,
  activeAbilitySet,
  activeAbilitySetId,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_IDS,
  attributeGroupOf,
  COST_MAX,
  COST_MIN,
  DAMAGE_CYCLE,
  DEFAULT_ABILITY_SET_ID,
  DEFAULT_ACTOR_IMG,
  DIFFICULTIES,
  DIFFICULTY_DEFAULT,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  FEATURE_MAX_INITIAL,
  HEALTH_ICON,
  HEALTH_LEVELS,
  HUMANITY_MAX,
  isAbilityCategory,
  isAttributeKey,
  isDifficulty,
  isPowerFamily,
  isSpecializationTargetKind,
  itemImg,
  MERIT_FLAW_CATEGORY_ORDER,
  MERIT_FLAW_IMG,
  MERIT_FLAW_TYPE_ORDER,
  MONEY_ICON,
  packWoundBoxes,
  parseSpecializationTarget,
  POWER_FAMILY_ORDER,
  SECONDARY_ABILITY_IMG,
  SPECIALIZATION_IMG,
  SPECIALIZATION_MIN_RATING,
  SPECIALIZATION_TARGET_KINDS,
  specializationArtworkCategory,
  TRAIT_MAX,
  VIRTUE_IDS,
  WILLPOWER_ICON,
  WILLPOWER_MAX,
  WOD,
  woundVignette,
};

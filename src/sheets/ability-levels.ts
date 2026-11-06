import clamp from 'lodash/clamp';
import isFinite from 'lodash/isFinite';

const ABILITY_LEVEL_MAX = 10;

const abilityLevelRank = (value: number): number | undefined => {
  if (!isFinite(value) || value < 1) {
    return undefined;
  }

  return clamp(Math.floor(value), 1, ABILITY_LEVEL_MAX);
};

type LevelTable = 'AbilityLevel' | 'AttributeLevel';

const levelKey = (table: LevelTable, id: string, value: number): string | undefined => {
  const rank = abilityLevelRank(value);

  if (rank === undefined) {
    return undefined;
  }

  return `WOD.${table}.${id}.${rank}`;
};

const levelText = (table: LevelTable, id: string, value: number): string | undefined => {
  const key = levelKey(table, id, value);

  if (key === undefined) {
    return undefined;
  }

  const text = game.i18n.localize(key);

  if (text === key) {
    return undefined;
  }

  return text;
};

const abilityLevelKey = (id: string, value: number): string | undefined => levelKey('AbilityLevel', id, value);

const abilityLevelText = (id: string, value: number): string | undefined => levelText('AbilityLevel', id, value);

const attributeLevelKey = (id: string, value: number): string | undefined => levelKey(
  'AttributeLevel',
  id,
  value,
);

const attributeLevelText = (id: string, value: number): string | undefined => levelText(
  'AttributeLevel',
  id,
  value,
);

export {
  ABILITY_LEVEL_MAX,
  abilityLevelKey,
  abilityLevelRank,
  abilityLevelText,
  attributeLevelKey,
  attributeLevelText,
};

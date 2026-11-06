import findLastIndex from 'lodash/findLastIndex';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';

import { HEALTH_LEVELS, packWoundBoxes } from '../../config';

/**
 * Уровни после Bruised. Индекс совпадает с правой заполненной клеткой трека.
 */
const WOUND_LEVEL_IDS = ['hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'] as const;

interface WoundLevel {
  id: WoundLevelId;
  penalty: number | undefined;
}

type WoundLevelId = (typeof WOUND_LEVEL_IDS)[number];

const WOUND_STATUS_IMG = {
  crippled: 'icons/svg/falling.svg',
  hurt: 'icons/svg/blood.svg',
  incapacitated: 'icons/svg/unconscious.svg',
  injured: 'icons/svg/bones.svg',
  mauled: 'icons/svg/trap.svg',
  wounded: 'icons/svg/degen.svg',
} satisfies Record<WoundLevelId, string>;

const woundStatusEffectId = (id: WoundLevelId): string => `wod-${id}`;

const WOUND_STATUS_EFFECT_IDS: readonly string[] = map(WOUND_LEVEL_IDS, woundStatusEffectId);

const isWoundLevelId = (value: string): value is WoundLevelId => includes(WOUND_LEVEL_IDS, value);

const isWoundStatusEffectId = (value: string): boolean => includes(WOUND_STATUS_EFFECT_IDS, value);

/**
 * Текущий уровень раны: правая заполненная клетка.
 * Bruised и пустой трек статуса не дают. Штрафы уровней не складываются.
 */
const woundLevel = (boxes: readonly string[]): WoundLevel | undefined => {
  const index = findLastIndex(packWoundBoxes(boxes), box => !isEmpty(box));
  const level = HEALTH_LEVELS[index];

  if (level === undefined || !isWoundLevelId(level.id)) {
    return undefined;
  }

  if (!('penalty' in level)) {
    return { id: level.id, penalty: undefined };
  }

  return { id: level.id, penalty: level.penalty };
};

export type { WoundLevel, WoundLevelId };
export {
  isWoundStatusEffectId,
  WOUND_LEVEL_IDS,
  WOUND_STATUS_IMG,
  woundLevel,
  woundStatusEffectId,
};

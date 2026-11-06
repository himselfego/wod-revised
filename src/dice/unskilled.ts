import type { AbilityCategory } from '../config';
import type { PoolKind, PoolPart } from './pool';

import clamp from 'lodash/clamp';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import isNil from 'lodash/isNil';
import reject from 'lodash/reject';
import some from 'lodash/some';

import {
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  isAbilityCategory,
} from '../config';

const RATED_ABILITY_KINDS: readonly PoolKind[] = ['ability', 'secondaryAbility'];

interface UnskilledPart extends PoolPart {
  category: AbilityCategory;
}

interface UnskilledState {
  blocked: boolean;
  category: AbilityCategory;
  penalty: 0 | 1;
}

const isUnskilledPart = (part: PoolPart): part is UnskilledPart => {
  if (!includes(RATED_ABILITY_KINDS, part.kind)) {
    return false;
  }

  if (part.value !== 0) {
    return false;
  }

  return isAbilityCategory(part.category);
};

const unskilledStateOf = (
  category: AbilityCategory,
  isUnskilledKnowledgeAllowed: boolean,
): UnskilledState => {
  if (category === 'knowledges') {
    return {
      blocked: !isUnskilledKnowledgeAllowed,
      category,
      penalty: 0,
    };
  }

  if (category === 'skills') {
    return {
      blocked: false,
      category,
      penalty: 1,
    };
  }

  return {
    blocked: false,
    category,
    penalty: 0,
  };
};

const unskilledParts = (parts: readonly PoolPart[]): UnskilledPart[] => filter(parts, isUnskilledPart);

const hasCategory = (
  parts: readonly UnskilledPart[],
  category: AbilityCategory,
): boolean => some(parts, { category });

const hasUnskilledKnowledge = (parts: readonly PoolPart[]): boolean => hasCategory(
  unskilledParts(parts),
  'knowledges',
);

const resolveUnskilled = (
  parts: readonly PoolPart[],
  isUnskilledKnowledgeAllowed = false,
): UnskilledState | undefined => {
  const zeros = unskilledParts(parts);

  if (zeros.length === 0) {
    return undefined;
  }

  if (!isUnskilledKnowledgeAllowed && hasCategory(zeros, 'knowledges')) {
    return unskilledStateOf('knowledges', false);
  }

  const open = isUnskilledKnowledgeAllowed
    ? reject(zeros, { category: 'knowledges' })
    : zeros;

  if (hasCategory(open, 'skills')) {
    return unskilledStateOf('skills', isUnskilledKnowledgeAllowed);
  }

  if (hasCategory(open, 'talents')) {
    return unskilledStateOf('talents', isUnskilledKnowledgeAllowed);
  }

  if (hasCategory(zeros, 'knowledges')) {
    return unskilledStateOf('knowledges', true);
  }

  return undefined;
};

const effectiveDifficulty = (declared: number, penalty = 0): number => clamp(
  declared + penalty,
  DIFFICULTY_MIN,
  DIFFICULTY_MAX,
);

const shouldShowSkillPenalty = (
  declared: number,
  unskilled: UnskilledState | undefined,
): boolean => !isNil(unskilled) && effectiveDifficulty(declared, unskilled.penalty) > declared;

export type {
  UnskilledState,
};
export {
  effectiveDifficulty,
  hasUnskilledKnowledge,
  resolveUnskilled,
  shouldShowSkillPenalty,
};

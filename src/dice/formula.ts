import type { PoolPart } from './pool';

import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import replace from 'lodash/replace';
import trim from 'lodash/trim';

import { poolFormula, poolTotal } from './pool';
import { effectiveDifficulty } from './unskilled';

const MINUS = '−';

interface FormulaView {
  difficultyLedger: string | undefined;
  effectiveDifficulty: number;
  formula: string;
  hasRiders: boolean;
  poolTotal: number;
  specialization: string | undefined;
  willSpendWillpower: boolean;
}

interface FormulaViewInput {
  adjust?: number;
  bonusLabel?: string;
  declared: number;
  parts: readonly PoolPart[];
  penalty: number;
  penaltyLabel?: string;
  specialization: string | undefined;
  willSpendWillpower: boolean;
  woundLabel?: string;
  woundPenalty?: number;
}

const difficultyLedger = (declared: number, penalty: number): string | undefined => {
  if (effectiveDifficulty(declared, penalty) <= declared) {
    return undefined;
  }

  return `${declared} + ${penalty}`;
};

const appendTerm = (
  formula: string,
  sign: '+' | '−',
  label: string,
  value: number,
): string => {
  const piece = `${sign} ${label} ${value}`;

  if (formula === '') {
    return piece;
  }

  return `${formula} ${piece}`;
};

const BLANK_ADJUST = ['', '+', '-'] as const;

const parsePoolAdjust = (value: string): number | undefined => {
  const trimmed = replace(trim(value), /−/g, '-');

  if (includes(BLANK_ADJUST, trimmed)) {
    return 0;
  }

  if (!/^[+-]?\d+$/.test(trimmed)) {
    return undefined;
  }

  return Number(trimmed);
};

const formulaView = ({
  adjust = 0,
  bonusLabel = 'bonus',
  declared,
  parts,
  penalty,
  penaltyLabel = 'penalty',
  specialization,
  willSpendWillpower,
  woundLabel,
  woundPenalty = 0,
}: FormulaViewInput): FormulaView => {
  const effective = effectiveDifficulty(declared, penalty);
  const ledger = difficultyLedger(declared, penalty);
  const woundDice = Math.max(0, woundPenalty);
  let formula = poolFormula(parts);

  if (woundDice > 0 && !isNil(woundLabel) && !isEmpty(woundLabel)) {
    formula = appendTerm(formula, MINUS, woundLabel, woundDice);
  }

  if (adjust !== 0) {
    formula = appendTerm(
      formula,
      adjust > 0 ? '+' : MINUS,
      adjust > 0 ? bonusLabel : penaltyLabel,
      Math.abs(adjust),
    );
  }

  return {
    difficultyLedger: ledger,
    effectiveDifficulty: effective,
    formula,
    hasRiders: willSpendWillpower || !isEmpty(specialization),
    poolTotal: Math.max(0, poolTotal(parts) + adjust - woundDice),
    specialization,
    willSpendWillpower,
  };
};

export type {
  FormulaView,
};
export {
  formulaView,
  parsePoolAdjust,
};

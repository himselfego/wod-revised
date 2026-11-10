import type { ActiveModifier } from './modifiers';
import type { PoolPart } from './pool';

import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import reject from 'lodash/reject';
import replace from 'lodash/replace';
import trim from 'lodash/trim';

import { modifierTotals } from './modifiers';
import { poolFormula, poolTotal } from './pool';
import { effectiveDifficulty } from './unskilled';

const MINUS = '−';

interface FormulaView {
  autoSuccesses: number;
  difficultyLedger: string | undefined;
  effectiveDifficulty: number;
  formula: string;
  hasRiders: boolean;
  ignoresWounds: boolean;
  poolTotal: number;
  specialization: string | undefined;
  willSpendWillpower: boolean;
}

interface FormulaViewInput {
  adjust?: number;
  bonusLabel?: string;
  declared: number;
  modifiers?: readonly ActiveModifier[];
  parts: readonly PoolPart[];
  penalty: number;
  penaltyLabel?: string;
  specialization: string | undefined;
  willSpendWillpower: boolean;
  woundLabel?: string;
  woundPenalty?: number;
}

interface LedgerInput {
  declared: number;
  effective: number;
  penalty: number;
  set: ActiveModifier | undefined;
  shifts: readonly ActiveModifier[];
}

const signOf = (value: number): '+' | '−' => (value > 0 ? '+' : MINUS);

/**
 * Откуда взялась сложность. Без модификаторов — как раньше: только «объявленная + неумелость».
 */
const difficultyLedger = ({ declared, effective, penalty, set, shifts }: LedgerInput): string | undefined => {
  if (isNil(set) && isEmpty(shifts)) {
    return effective > declared ? `${declared} + ${penalty}` : undefined;
  }

  let ledger = isNil(set) ? String(declared) : `${set.setDifficulty} (${set.label})`;

  if (penalty > 0) {
    ledger += ` + ${penalty}`;
  }

  for (const shift of shifts) {
    ledger += ` ${signOf(shift.difficulty)} ${Math.abs(shift.difficulty)} ${shift.label}`;
  }

  return ledger;
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

interface DiceTermsInput {
  adjust: number;
  bonusLabel: string;
  modifiers: readonly ActiveModifier[];
  penaltyLabel: string;
  woundDice: number;
  woundLabel: string | undefined;
}

/**
 * Слагаемые после характеристик: рана, затем черты, ручной бонус последним.
 */
const appendDiceTerms = (
  pool: string,
  { adjust, bonusLabel, modifiers, penaltyLabel, woundDice, woundLabel }: DiceTermsInput,
): string => {
  let formula = pool;

  if (woundDice > 0 && !isNil(woundLabel) && !isEmpty(woundLabel)) {
    formula = appendTerm(formula, MINUS, woundLabel, woundDice);
  }

  const diceModifiers = reject(modifiers, { dice: 0 });

  for (const modifier of diceModifiers) {
    formula = appendTerm(formula, signOf(modifier.dice), modifier.label, Math.abs(modifier.dice));
  }

  if (adjust !== 0) {
    formula = appendTerm(formula, signOf(adjust), adjust > 0 ? bonusLabel : penaltyLabel, Math.abs(adjust));
  }

  return formula;
};

const formulaView = ({
  adjust = 0,
  bonusLabel = 'bonus',
  declared,
  modifiers = [],
  parts,
  penalty,
  penaltyLabel = 'penalty',
  specialization,
  willSpendWillpower,
  woundLabel,
  woundPenalty = 0,
}: FormulaViewInput): FormulaView => {
  const totals = modifierTotals(modifiers);
  const effective = effectiveDifficulty(totals.setDifficulty?.setDifficulty ?? declared, penalty + totals.difficulty);
  const isIgnoresWounds = totals.ignoreWounds && woundPenalty > 0;
  const woundDice = isIgnoresWounds ? 0 : Math.max(0, woundPenalty);

  return {
    autoSuccesses: totals.successes,
    difficultyLedger: difficultyLedger({
      declared,
      effective,
      penalty,
      set: totals.setDifficulty,
      shifts: reject(modifiers, { difficulty: 0 }),
    }),
    effectiveDifficulty: effective,
    formula: appendDiceTerms(poolFormula(parts), {
      adjust,
      bonusLabel,
      modifiers,
      penaltyLabel,
      woundDice,
      woundLabel,
    }),
    hasRiders: willSpendWillpower || !isEmpty(specialization) || totals.successes > 0 || isIgnoresWounds,
    ignoresWounds: isIgnoresWounds,
    poolTotal: Math.max(0, poolTotal(parts) + adjust + totals.dice - woundDice),
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

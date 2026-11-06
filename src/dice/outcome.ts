import filter from 'lodash/filter';
import map from 'lodash/map';
import size from 'lodash/size';
import sortBy from 'lodash/sortBy';

interface PoolDie {
  face: number;
  hit: boolean;
  one: boolean;
}

interface PoolOutcome {
  dice: PoolDie[];
  extraDice: PoolDie[];
  successes: number;
  verdict: RollVerdict;
}

type RollVerdict = 'botch' | 'failure' | 'success';

const toDie = (difficulty: number, face: number): PoolDie => ({
  face,
  hit: face >= difficulty,
  one: face === 1,
});

const toExtraDie = (difficulty: number, face: number): PoolDie => ({
  face,
  hit: face >= difficulty,
  one: false,
});

const verdictOf = (hits: number, ones: number, successes: number): RollVerdict => {
  if (successes > 0) {
    return 'success';
  }

  if (hits === 0 && ones > 0) {
    return 'botch';
  }

  return 'failure';
};

const resolvePoolOutcome = (
  faces: readonly number[],
  difficulty: number,
  willSpendWillpower = false,
  extraFaces: readonly number[] = [],
): PoolOutcome => {
  const dice = map(sortBy(faces), face => toDie(difficulty, face));
  const extraDice = map(sortBy(extraFaces), face => toExtraDie(difficulty, face));
  const hits = size(filter(dice, 'hit'));
  const ones = size(filter(dice, 'one'));
  const extraHits = size(filter(extraDice, 'hit'));
  const successes = Math.max(hits - ones, 0) + extraHits + (willSpendWillpower ? 1 : 0);

  return {
    dice,
    extraDice,
    successes,
    verdict: verdictOf(hits, ones, successes),
  };
};

export type {
  PoolDie,
  PoolOutcome,
  RollVerdict,
};
export {
  resolvePoolOutcome,
};

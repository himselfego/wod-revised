import isNil from 'lodash/isNil';

import { woundLevel } from '../effects/wound/wound';

interface RollWound {
  blocked: boolean;
  labelKey: string | undefined;
  penalty: number;
}

const rollWound = (boxes: readonly string[]): RollWound => {
  const level = woundLevel(boxes);

  if (isNil(level) || level.penalty === 0) {
    return {
      blocked: false,
      labelKey: undefined,
      penalty: 0,
    };
  }

  if (level.penalty === undefined) {
    return {
      blocked: true,
      labelKey: undefined,
      penalty: 0,
    };
  }

  return {
    blocked: false,
    labelKey: `WOD.Health.${level.id}`,
    penalty: level.penalty,
  };
};

export type {
  RollWound,
};
export {
  rollWound,
};

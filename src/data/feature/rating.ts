import isNumber from 'lodash/isNumber';
import set from 'lodash/set';

const clampFeatureValue = (model: object): void => {
  const max: unknown = Reflect.get(model, 'max');
  const value: unknown = Reflect.get(model, 'value');

  if (!isNumber(max) || !isNumber(value)) {
    return;
  }

  const next = Math.min(value, max);

  if (next === value) {
    return;
  }

  set(model, 'value', next);
};

export { clampFeatureValue };

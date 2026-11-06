import isPlainObject from 'lodash/isPlainObject';

const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

export {
  isRecord,
};

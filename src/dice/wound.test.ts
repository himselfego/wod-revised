import constant from 'lodash/constant';
import times from 'lodash/times';
import { describe, expect, it } from 'vitest';

import { rollWound } from './wound';

describe('rollWound', () => {
  it('ignores an empty track and bruised', () => {
    expect(rollWound([])).toStrictEqual({
      blocked: false,
      labelKey: undefined,
      penalty: 0,
    });
    expect(rollWound(['bashing'])).toStrictEqual({
      blocked: false,
      labelKey: undefined,
      penalty: 0,
    });
  });

  it('reads the current level penalty without stacking', () => {
    expect(rollWound(times(2, constant('bashing')))).toStrictEqual({
      blocked: false,
      labelKey: 'WOD.Health.hurt',
      penalty: 1,
    });
    expect(rollWound(times(6, constant('lethal')))).toStrictEqual({
      blocked: false,
      labelKey: 'WOD.Health.crippled',
      penalty: 5,
    });
  });

  it('closes the roll at incapacitated', () => {
    expect(rollWound(times(7, constant('aggravated')))).toStrictEqual({
      blocked: true,
      labelKey: undefined,
      penalty: 0,
    });
  });
});

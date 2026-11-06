import type { PowerFamily } from '../../config';

import { FEATURE_MAX_INITIAL, POWER_FAMILY_ORDER } from '../../config';
import { clampFeatureValue } from './rating';

const { ArrayField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

interface PowerLevel {
  description: string;
  name: string;
  rank: number;
}

interface PowerSystem {
  description: string;
  family: PowerFamily;
  levels: PowerLevel[];
  max: number;
  mechanics: string;
  value: number;
}

const powerLevelField = (): object => new SchemaField({
  description: new HTMLField({ initial: '', required: true }),
  name: new StringField({ blank: true, initial: '', required: true }),
  rank: new NumberField({
    initial: 1,
    integer: true,
    min: 1,
    required: true,
  }),
});

export class PowerDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      description: new HTMLField({ initial: '', required: true }),
      family: new StringField({
        choices: POWER_FAMILY_ORDER,
        initial: 'numina',
        required: true,
      }),
      levels: new ArrayField(powerLevelField(), {
        initial: [],
        required: true,
      }),
      max: new NumberField({
        initial: FEATURE_MAX_INITIAL,
        integer: true,
        min: 1,
        required: true,
      }),
      mechanics: new HTMLField({ blank: true, initial: '', required: false }),
      value: new NumberField({
        initial: 1,
        integer: true,
        min: 0,
        required: true,
      }),
    };
  }

  public override prepareBaseData(): void {
    clampFeatureValue(this);
  }
}

export type { PowerLevel, PowerSystem };

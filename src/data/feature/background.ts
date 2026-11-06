import { FEATURE_MAX_INITIAL } from '../../config';
import { clampFeatureValue } from './rating';

const { ArrayField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

interface BackgroundStep {
  description: string;
  rank: number;
}

interface BackgroundSystem {
  description: string;
  max: number;
  mechanics: string;
  steps: BackgroundStep[];
  value: number;
}

const backgroundStepField = (): object => new SchemaField({
  description: new StringField({ blank: true, initial: '', required: true }),
  rank: new NumberField({
    initial: 1,
    integer: true,
    min: 1,
    required: true,
  }),
});

export class BackgroundDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      description: new HTMLField({ initial: '', required: true }),
      max: new NumberField({
        initial: FEATURE_MAX_INITIAL,
        integer: true,
        min: 1,
        required: true,
      }),
      mechanics: new HTMLField({ blank: true, initial: '', required: false }),
      steps: new ArrayField(backgroundStepField(), {
        initial: [],
        required: true,
      }),
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

export type { BackgroundStep, BackgroundSystem };

import type { MeritFlawCategory } from '../../config';

import { COST_MAX, COST_MIN, MERIT_FLAW_CATEGORY_ORDER } from '../../config';

const { HTMLField, NumberField, StringField } = foundry.data.fields;

export interface MeritFlawSystem {
  category: MeritFlawCategory;
  cost: number;
  description: string;
}

export class MeritFlawDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      category: new StringField({
        choices: MERIT_FLAW_CATEGORY_ORDER,
        initial: 'physical',
        required: true,
      }),
      cost: new NumberField({
        initial: COST_MIN,
        integer: true,
        max: COST_MAX,
        min: COST_MIN,
        required: true,
      }),
      description: new HTMLField({ initial: '', required: true }),
    };
  }
}

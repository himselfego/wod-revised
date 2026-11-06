import type { AbilityCategory } from '../../config';

import { ABILITY_CATEGORY_ORDER, TRAIT_MAX } from '../../config';

const { HTMLField, NumberField, StringField } = foundry.data.fields;

export interface SecondaryAbilitySystem {
  category: AbilityCategory;
  description: string;
  value: number;
}

export class SecondaryAbilityDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      category: new StringField({
        choices: ABILITY_CATEGORY_ORDER,
        initial: 'talents',
        required: true,
      }),
      description: new HTMLField({ initial: '', required: true }),
      value: new NumberField({
        initial: 1,
        integer: true,
        max: TRAIT_MAX,
        min: 0,
        required: true,
      }),
    };
  }
}

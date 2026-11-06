import type { SpecializationTargetKind } from '../../config';

import { SPECIALIZATION_TARGET_KINDS } from '../../config';

const { StringField } = foundry.data.fields;

export interface SpecializationSystem {
  targetId: string;
  targetKind: SpecializationTargetKind;
}

export class SpecializationDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      targetId: new StringField({ initial: 'strength', required: true }),
      targetKind: new StringField({
        choices: SPECIALIZATION_TARGET_KINDS,
        initial: 'attribute',
        required: true,
      }),
    };
  }
}

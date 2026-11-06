import type { AbilitySetId, DamageState, VirtueId } from '../../config';

import assign from 'lodash/assign';
import constant from 'lodash/constant';
import fromPairs from 'lodash/fromPairs';
import get from 'lodash/get';
import isNumber from 'lodash/isNumber';
import map from 'lodash/map';
import set from 'lodash/set';
import times from 'lodash/times';

import {
  ABILITY_IDS,
  ABILITY_SET_IDS,
  DEFAULT_ABILITY_SET_ID,
  HEALTH_LEVELS,
  HUMANITY_MAX,
  TRAIT_MAX,
  VIRTUE_IDS,
  WILLPOWER_MAX,
} from '../../config';
import { isRecord } from '../../guards';

const { ArrayField, NumberField, SchemaField, StringField } = foundry.data.fields;

const emptyHealthBoxes = (): DamageState[] => times(HEALTH_LEVELS.length, constant<DamageState>(''));

const trait = (initial: number): object => new SchemaField({
  value: new NumberField({
    initial,
    integer: true,
    max: TRAIT_MAX,
    min: 0,
    required: true,
  }),
});

interface MortalSystem {
  abilities: Record<string, TraitValue>;
  abilitySet: AbilitySetId;
  attributes: {
    appearance: TraitValue;
    charisma: TraitValue;
    dexterity: TraitValue;
    intelligence: TraitValue;
    manipulation: TraitValue;
    perception: TraitValue;
    stamina: TraitValue;
    strength: TraitValue;
    wits: TraitValue;
  };
  concept: string;
  demeanor: string;
  health: {
    boxes: DamageState[];
  };
  humanity: number;
  money: number;
  nature: string;
  virtues: Record<VirtueId, TraitValue>;
  willpower: {
    permanent: number;
    temporary: number;
  };
}

interface TraitValue {
  value: number;
}

/**
 * Число из `changed` апдейта: вложенный `{ system: { … } }` или плоский ключ `'system.…'`.
 */
const changedNumber = (changed: Record<string, unknown>, path: string): number | undefined => {
  const nested: unknown = get(changed, path);

  if (isNumber(nested)) {
    return nested;
  }

  const flat = changed[path];

  if (isNumber(flat)) {
    return flat;
  }

  return undefined;
};

const clampWillpowerChange = (
  current: MortalSystem['willpower'],
  changed: Record<string, unknown>,
): void => {
  const nextPermanent = changedNumber(changed, 'system.willpower.permanent');
  const nextTemporary = changedNumber(changed, 'system.willpower.temporary');

  if (nextPermanent === undefined && nextTemporary === undefined) {
    return;
  }

  const permanent = nextPermanent ?? current.permanent;
  const temporary = nextTemporary ?? current.temporary;
  const clamped = Math.min(temporary, permanent);

  if (clamped === temporary) {
    return;
  }

  const flatTemporary = 'system.willpower.temporary';

  if (Object.hasOwn(changed, 'system.willpower.permanent') || Object.hasOwn(changed, flatTemporary)) {
    assign(changed, { [flatTemporary]: clamped });

    return;
  }

  set(changed, 'system.willpower.temporary', clamped);
};

const MONEY_CENTS = 100;

const roundMoney = (value: number): number => Math.max(0, Math.round(value * MONEY_CENTS) / MONEY_CENTS);

const clampMoneyChange = (changed: Record<string, unknown>): void => {
  const current = changedNumber(changed, 'system.money');

  if (current === undefined) {
    return;
  }

  const next = roundMoney(current);

  if (next === current) {
    return;
  }

  if (Object.hasOwn(changed, 'system.money')) {
    assign(changed, { 'system.money': next });

    return;
  }

  set(changed, 'system.money', next);
};

class MortalDataModel extends foundry.abstract.TypeDataModel {
  public static override defineSchema(): Record<string, unknown> {
    return {
      abilities: new SchemaField(
        fromPairs(map(ABILITY_IDS, (id): [string, object] => [id, trait(0)])),
      ),
      abilitySet: new StringField({
        choices: ABILITY_SET_IDS,
        initial: DEFAULT_ABILITY_SET_ID,
        required: true,
      }),
      attributes: new SchemaField({
        appearance: trait(1),
        charisma: trait(1),
        dexterity: trait(1),
        intelligence: trait(1),
        manipulation: trait(1),
        perception: trait(1),
        stamina: trait(1),
        strength: trait(1),
        wits: trait(1),
      }),
      concept: new StringField({ initial: '', required: true }),
      demeanor: new StringField({ initial: '', required: true }),
      health: new SchemaField({
        boxes: new ArrayField(
          new StringField({
            blank: true,
            choices: ['bashing', 'lethal', 'aggravated'],
            initial: '',
            required: true,
          }),
          {
            initial: emptyHealthBoxes,
            required: true,
          },
        ),
      }),
      humanity: new NumberField({
        initial: 7,
        integer: true,
        max: HUMANITY_MAX,
        min: 0,
        required: true,
      }),
      money: new NumberField({
        initial: 0,
        min: 0,
        required: true,
      }),
      nature: new StringField({ initial: '', required: true }),
      virtues: new SchemaField(
        fromPairs(map(VIRTUE_IDS, (id): [string, object] => [id, trait(1)])),
      ),
      willpower: new SchemaField({
        permanent: new NumberField({
          initial: 3,
          integer: true,
          max: WILLPOWER_MAX,
          min: 0,
          required: true,
        }),
        temporary: new NumberField({
          initial: 3,
          integer: true,
          max: WILLPOWER_MAX,
          min: 0,
          required: true,
        }),
      }),
    };
  }

  public override prepareBaseData(): void {
    const willpower = Reflect.get(this, 'willpower');

    if (isRecord(willpower)) {
      const { permanent, temporary } = willpower;

      if (isNumber(permanent) && isNumber(temporary)) {
        const nextWillpower = Math.min(temporary, permanent);

        if (nextWillpower !== temporary) {
          set(this, 'willpower.temporary', nextWillpower);
        }
      }
    }

    const money = Reflect.get(this, 'money');

    if (!isNumber(money)) {
      return;
    }

    const nextMoney = roundMoney(money);

    if (nextMoney === money) {
      return;
    }

    set(this, 'money', nextMoney);
  }
}

export type {
  MortalSystem,
  TraitValue,
};
export {
  clampMoneyChange,
  clampWillpowerChange,
  MortalDataModel,
};

import type { AbilityCategory, AbilitySetId } from '../config';
import type { TraitKind } from '../data/traits';

import concat from 'lodash/concat';
import filter from 'lodash/filter';
import flatMap from 'lodash/flatMap';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import join from 'lodash/join';
import map from 'lodash/map';
import sumBy from 'lodash/sumBy';

import {
  ABILITY_CATEGORY_ORDER,
  ABILITY_SETS,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_GROUPS,
  VIRTUE_IDS,
} from '../config';
import { isTraitKind, secondaryAbilitiesOf, TRAIT_KINDS, traitRating } from '../data/traits';

const POOL_KINDS = TRAIT_KINDS;

interface LocalizedPartInput {
  category?: AbilityCategory;
  id: string;
  kind: PoolKind;
  labelKey: string;
  value: number;
}

interface NumberedPartInput {
  category?: AbilityCategory;
  id: string;
  kind: PoolKind;
  label: string;
  value: number;
}

interface PoolHost {
  document: FoundryActor;
  clearPool: () => void;
  onDialogClosed: () => void;
  poolKeys: () => ReadonlySet<string>;
  removePoolKey: (key: string) => void;
}

type PoolKind = TraitKind;

interface PoolPart {
  category?: AbilityCategory;
  id: string;
  key: string;
  kind: PoolKind;
  label: string;
  value: number;
}

const isPoolKind = isTraitKind;

const poolKey = (kind: PoolKind, id: string): string => `${kind}:${id}`;

const parsePoolKey = (value: unknown): { id: string; kind: PoolKind } | undefined => {
  if (!isString(value)) {
    return undefined;
  }

  const separator = value.indexOf(':');

  if (separator <= 0) {
    return undefined;
  }

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);

  if (!isPoolKind(kind) || isEmpty(id)) {
    return undefined;
  }

  return { id, kind };
};

const numberedPart = ({
  category,
  id,
  kind,
  label,
  value,
}: NumberedPartInput): PoolPart => ({
  category,
  id,
  key: poolKey(kind, id),
  kind,
  label,
  value,
});

const localizedPart = ({
  category,
  id,
  kind,
  labelKey,
  value,
}: LocalizedPartInput): PoolPart => numberedPart({
  category,
  id,
  kind,
  label: game.i18n.localize(labelKey),
  value,
});

const abilitySetOf = (actor: FoundryActor): AbilitySetId => actor.system.abilitySet;

const attributeParts = (actor: FoundryActor): PoolPart[] => flatMap(
  ATTRIBUTE_GROUP_ORDER,
  group => map(ATTRIBUTE_GROUPS[group], id => localizedPart({
    id,
    kind: 'attribute',
    labelKey: `WOD.Attribute.${id}`,
    value: traitRating(actor, 'attribute', id),
  })),
);

const abilityParts = (actor: FoundryActor): PoolPart[] => {
  const set = ABILITY_SETS[abilitySetOf(actor)];

  return flatMap(
    ABILITY_CATEGORY_ORDER,
    category => map(set[category], id => localizedPart({
      category,
      id,
      kind: 'ability',
      labelKey: `WOD.Ability.${id}`,
      value: traitRating(actor, 'ability', id),
    })),
  );
};

const virtueParts = (actor: FoundryActor): PoolPart[] => [
  ...map(
    VIRTUE_IDS,
    id => localizedPart({
      id,
      kind: 'virtue',
      labelKey: `WOD.Virtue.${id}`,
      value: traitRating(actor, 'virtue', id),
    }),
  ),
];

const soulParts = (actor: FoundryActor): PoolPart[] => [
  localizedPart({
    id: 'humanity',
    kind: 'humanity',
    labelKey: 'WOD.Field.humanity',
    value: traitRating(actor, 'humanity', 'humanity'),
  }),
  localizedPart({
    id: 'willpower',
    kind: 'willpower',
    labelKey: 'WOD.Field.willpower',
    value: traitRating(actor, 'willpower', 'willpower'),
  }),
];

const secondaryParts = (actor: FoundryActor): PoolPart[] => flatMap(
  ABILITY_CATEGORY_ORDER,
  category => map(secondaryAbilitiesOf(actor.items.contents, category), item => numberedPart({
    category,
    id: item.id,
    kind: 'secondaryAbility',
    label: item.name,
    value: traitRating(actor, 'secondaryAbility', item.id),
  })),
);

const catalogPoolParts = (actor: FoundryActor): PoolPart[] => concat(
  attributeParts(actor),
  abilityParts(actor),
  virtueParts(actor),
  soulParts(actor),
  secondaryParts(actor),
);

const resolvePoolParts = (
  actor: FoundryActor,
  keys: ReadonlySet<string>,
): PoolPart[] => filter(catalogPoolParts(actor), part => keys.has(part.key));

const poolTotal = (parts: readonly PoolPart[]): number => sumBy(parts, 'value');

const poolFormula = (parts: readonly PoolPart[]): string => {
  if (isEmpty(parts)) {
    return '';
  }

  return join(map(parts, part => `${part.label} ${part.value}`), ' + ');
};

const prunePoolKeys = (actor: FoundryActor, keys: Set<string>): void => {
  const valid = new Set(map(catalogPoolParts(actor), 'key'));

  for (const key of keys) {
    if (!valid.has(key)) {
      keys.delete(key);
    }
  }
};

export type {
  PoolHost,
  PoolKind,
  PoolPart,
};
export {
  catalogPoolParts,
  isPoolKind,
  parsePoolKey,
  POOL_KINDS,
  poolFormula,
  poolKey,
  poolTotal,
  prunePoolKeys,
  resolvePoolParts,
};

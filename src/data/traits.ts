import type { AbilityCategory } from '../config';
import type { MortalSystem } from './splat/mortal';

import filter from 'lodash/filter';
import get from 'lodash/get';
import includes from 'lodash/includes';
import matches from 'lodash/matches';
import sortBy from 'lodash/sortBy';
import toLower from 'lodash/toLower';

const TRAIT_KINDS = [
  'ability',
  'attribute',
  'humanity',
  'secondaryAbility',
  'virtue',
  'willpower',
] as const;

interface TraitHost<Item extends TraitItem = TraitItem> {
  items: {
    contents: readonly Item[];
    get: (id: string) => Item | undefined;
  };
  system: MortalSystem;
}

interface TraitItem {
  id: string;
  name: string;
  system: {
    category?: string;
    targetId?: string;
    targetKind?: string;
    value?: number;
  };
  type: string;
}

type TraitKind = (typeof TRAIT_KINDS)[number];

const isTraitKind = (value: unknown): value is TraitKind => includes(
  TRAIT_KINDS as readonly unknown[],
  value,
);

const byName = <Item extends TraitItem>(items: readonly Item[]): Item[] => sortBy(items, item => toLower(item.name));

const TRAIT_RATINGS: Record<TraitKind, (host: TraitHost, id: string) => number> = {
  ability: ({ system }, id) => Number(get(system.abilities, `${id}.value`, 0)),
  attribute: ({ system }, id) => Number(get(system.attributes, `${id}.value`, 0)),
  humanity: ({ system }) => Number(system.humanity),
  secondaryAbility: ({ items }, id) => {
    const item = items.get(id);

    if (item?.type !== 'secondaryAbility') {
      return 0;
    }

    return Number(get(item.system, 'value', 0));
  },
  virtue: ({ system }, id) => Number(get(system.virtues, `${id}.value`, 0)),
  willpower: ({ system }) => Number(system.willpower.permanent),
};

/**
 * Итоговый рейтинг черты для листа, броска и порога спеки.
 * У вторичной `id` — id предмета; у человечности и воли `id` не читается.
 */
const traitRating = (host: TraitHost, kind: TraitKind, id: string): number => TRAIT_RATINGS[kind](host, id);

const secondaryAbilitiesOf = <Item extends TraitItem>(
  items: readonly Item[],
  category: AbilityCategory,
  // eslint-disable-next-line lodash/matches-shorthand -- объектный шорткат lodash не типизируется на дженерике Item
): Item[] => byName(filter(items, matches({ system: { category }, type: 'secondaryAbility' })));

const specializationsOf = <Item extends TraitItem>(
  items: readonly Item[],
  targetKind: string,
  targetId: string,
  // eslint-disable-next-line lodash/matches-shorthand -- объектный шорткат lodash не типизируется на дженерике Item
): Item[] => byName(filter(items, matches({ system: { targetId, targetKind }, type: 'specialization' })));

export type {
  TraitHost,
  TraitItem,
  TraitKind,
};
export {
  isTraitKind,
  secondaryAbilitiesOf,
  specializationsOf,
  TRAIT_KINDS,
  traitRating,
};

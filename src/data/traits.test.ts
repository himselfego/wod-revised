import type { MortalSystem } from './splat/mortal';
import type { TraitHost, TraitItem } from './traits';

import find from 'lodash/find';
import map from 'lodash/map';
import { describe, expect, it } from 'vitest';

import { secondaryAbilitiesOf, specializationsOf, traitRating } from './traits';

const rated = (value: number): { value: number } => ({ value });

const mortalSystem = (): MortalSystem => ({
  abilities: { brawl: rated(2), occult: rated(0) },
  abilitySet: 'revised-modern',
  attributes: {
    appearance: rated(1),
    charisma: rated(2),
    dexterity: rated(3),
    intelligence: rated(1),
    manipulation: rated(1),
    perception: rated(1),
    stamina: rated(1),
    strength: rated(4),
    wits: rated(1),
  },
  concept: '',
  demeanor: '',
  health: { boxes: [] },
  humanity: 7,
  money: 0,
  nature: '',
  virtues: { conscience: rated(3), courage: rated(1), selfControl: rated(2) },
  willpower: { permanent: 5, temporary: 2 },
});

const ITEMS: TraitItem[] = [
  { id: 'b', name: 'beta', system: { category: 'skills', value: 3 }, type: 'secondaryAbility' },
  { id: 'a', name: 'Alpha', system: { category: 'skills', value: 1 }, type: 'secondaryAbility' },
  { id: 'k', name: 'Lore', system: { category: 'knowledges', value: 2 }, type: 'secondaryAbility' },
  { id: 'm', name: 'Brawler', system: { category: 'skills' }, type: 'merit' },
  { id: 's2', name: 'grappling', system: { targetId: 'brawl', targetKind: 'ability' }, type: 'specialization' },
  { id: 's1', name: 'Boxing', system: { targetId: 'brawl', targetKind: 'ability' }, type: 'specialization' },
  { id: 's3', name: 'Lifting', system: { targetId: 'strength', targetKind: 'attribute' }, type: 'specialization' },
];

const host = (): TraitHost => ({
  items: {
    contents: ITEMS,
    get: (id: string) => find(ITEMS, ['id', id]),
  },
  system: mortalSystem(),
});

describe('trait rating', () => {
  it('reads attributes, abilities and virtues by id', () => {
    expect(traitRating(host(), 'attribute', 'strength')).toBe(4);
    expect(traitRating(host(), 'ability', 'brawl')).toBe(2);
    expect(traitRating(host(), 'virtue', 'conscience')).toBe(3);
  });

  it('reads humanity and permanent willpower, not temporary', () => {
    expect(traitRating(host(), 'humanity', 'humanity')).toBe(7);
    expect(traitRating(host(), 'willpower', 'willpower')).toBe(5);
  });

  it('reads a secondary ability by item id', () => {
    expect(traitRating(host(), 'secondaryAbility', 'b')).toBe(3);
  });

  it('gives 0 for an unknown id or an item of another type', () => {
    expect(traitRating(host(), 'ability', 'missing')).toBe(0);
    expect(traitRating(host(), 'secondaryAbility', 'missing')).toBe(0);
    expect(traitRating(host(), 'secondaryAbility', 'm')).toBe(0);
  });
});

describe('trait lists', () => {
  it('keeps secondary abilities of one category, sorted by name without case', () => {
    expect(map(secondaryAbilitiesOf(ITEMS, 'skills'), 'id')).toStrictEqual(['a', 'b']);
    expect(map(secondaryAbilitiesOf(ITEMS, 'talents'), 'id')).toStrictEqual([]);
  });

  it('keeps specializations of one host, sorted by name without case', () => {
    expect(map(specializationsOf(ITEMS, 'ability', 'brawl'), 'id')).toStrictEqual(['s1', 's2']);
    expect(map(specializationsOf(ITEMS, 'attribute', 'brawl'), 'id')).toStrictEqual([]);
  });
});

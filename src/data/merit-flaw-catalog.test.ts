import map from 'lodash/map';
import split from 'lodash/split';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import catalog from '../../data/merits-flaws/mortals-merits-flaws.json';
import { COST_MAX, COST_MIN, MERIT_FLAW_CATEGORY_ORDER, MERIT_FLAW_TYPE_ORDER } from '../config';

// Лимит Foundry на вложенность папок в компендиуме.
const FOLDER_MAX_DEPTH = 3;

const folderPaths = new Set(map(catalog.folders, 'path'));

describe('каталог mortals-merits-flaws', () => {
  it.each(map(catalog.folders, folder => [folder.path, folder] as const))('%s: родитель есть, глубина в лимите', (
    _path,
    folder,
  ) => {
    expect(folder.parent === null || folderPaths.has(folder.parent)).toBe(true);
    expect(split(folder.path, '/').length).toBeLessThanOrEqual(FOLDER_MAX_DEPTH);
  });

  it('у ключей нет повторов', () => {
    expect(new Set(map(catalog.items, 'key')).size).toBe(catalog.items.length);
  });

  it.each(map(catalog.items, item => [item.key, item] as const))('%s: поля и иконка верны', (_key, item) => {
    const { category, cost, description } = item.system;

    expect(MERIT_FLAW_TYPE_ORDER).toContain(item.type);
    expect(MERIT_FLAW_CATEGORY_ORDER).toContain(category);
    expect(cost).toBeGreaterThanOrEqual(COST_MIN);
    expect(cost).toBeLessThanOrEqual(COST_MAX);
    expect(folderPaths.has(item.folder)).toBe(true);
    expect(item.img).toBe(`assets/icons/merits-flaws/${item.type}-${category}-${cost}.webp`);
    expect(existsSync(item.img)).toBe(true);
    expect(description).toMatch(/^<p>/);
    // Ссылка внутри пака не переживёт смену id, а чужая сразу битая.
    expect(description).not.toMatch(/data-uuid|@UUID/);
  });
});

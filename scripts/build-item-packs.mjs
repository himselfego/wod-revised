import { ClassicLevel } from 'classic-level';
import { createHash } from 'node:crypto';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { dirname, join } = path;
const CATALOG_DIRS = ['backgrounds', 'merits-flaws'];
const SYSTEM_ID = 'wod-revised';
const SORT_STEP = 100_000;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const foundryId = seed => createHash('sha256').update(seed).digest('hex').slice(0, 16);

const listDirectory = async (directory) => {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const readCatalogDir = async (dirName) => {
  const directory = join(root, 'data', dirName);
  const listing = await listDirectory(directory);
  const names = listing.filter(name => name.endsWith('.json')).toSorted((left, right) => left.localeCompare(right));

  return Promise.all(names.map(async (name) => {
    const contents = await readFile(join(directory, name), 'utf8');

    return JSON.parse(contents);
  }));
};

const readCatalogs = async () => {
  const catalogs = [];

  for (const dirName of CATALOG_DIRS) {
    catalogs.push(...await readCatalogDir(dirName));
  }

  return catalogs;
};

const folderKey = folder => folder.path ?? folder.name;

const pushChild = (groups, parent, document) => {
  const list = groups.get(parent) ?? [];

  list.push(document);
  groups.set(parent, list);
};

const assignSiblingSort = (folders, items) => {
  const folderChildren = new Map();
  const itemChildren = new Map();

  for (const folder of folders) {
    pushChild(folderChildren, folder.folder ?? null, folder);
  }

  for (const item of items) {
    pushChild(itemChildren, item.folder ?? null, item);
  }

  const parents = new Set([...folderChildren.keys(), ...itemChildren.keys()]);

  for (const parent of parents) {
    const siblingFolders = folderChildren.get(parent) ?? [];
    const siblingItems = itemChildren.get(parent) ?? [];
    let order = 1;

    for (const folder of siblingFolders) {
      folder.sort = order * SORT_STEP;
      order += 1;
    }

    for (const item of siblingItems) {
      item.sort = order * SORT_STEP;
      order += 1;
    }
  }
};

const packDocuments = (catalog) => {
  const packSeed = `${SYSTEM_ID}:${catalog.name}`;
  const folders = catalog.folders.map((folder) => {
    const key = folderKey(folder);

    return {
      _id: foundryId(`${packSeed}:folder:${key}`),
      color: folder.color ?? null,
      flags: {},
      folder: null,
      key,
      name: folder.name,
      parentKey: folder.parent ?? null,
      sort: 0,
      sorting: folder.sorting ?? 'a',
      type: 'Item',
    };
  });
  const folderIds = new Map(folders.map(folder => [folder.key, folder._id]));

  for (const folder of folders) {
    if (!folder.parentKey) {
      continue;
    }

    const parentId = folderIds.get(folder.parentKey);

    if (!parentId) {
      throw new Error(`${catalog.name}: нет родителя ${folder.parentKey} у ${folder.name}`);
    }

    folder.folder = parentId;
  }

  const items = catalog.items.map((item) => {
    const folderId = item.folder ? folderIds.get(item.folder) : null;

    if (!folderId && item.folder) {
      throw new Error(`${catalog.name}: нет папки ${item.folder}`);
    }

    if (!item.type) {
      throw new Error(`${catalog.name}: у ${item.name} нет type`);
    }

    return {
      _id: foundryId(`${packSeed}:item:${item.key ?? item.name}`),
      effects: [],
      flags: {},
      folder: folderId ?? null,
      img: `systems/${SYSTEM_ID}/${item.img}`,
      name: item.name,
      ownership: { default: 0 },
      sort: 0,
      system: item.system,
      type: item.type,
    };
  });

  assignSiblingSort(folders, items);

  for (const folder of folders) {
    delete folder.key;
    delete folder.parentKey;
  }

  const ids = new Set();

  for (const document of [...folders, ...items]) {
    if (ids.has(document._id)) {
      throw new Error(`${catalog.name}: повтор id у ${document.name}`);
    }

    ids.add(document._id);
  }

  return { folders, items };
};

const writePack = async (catalog) => {
  const { folders, items } = packDocuments(catalog);
  const packDirectory = join(root, 'packs', catalog.name);

  await rm(packDirectory, { force: true, recursive: true });
  const database = new ClassicLevel(packDirectory, { valueEncoding: 'json' });

  await database.open();
  await database.batch([
    ...folders.map(folder => ({
      key: `!folders!${folder._id}`,
      type: 'put',
      value: folder,
    })),
    ...items.map(item => ({
      key: `!items!${item._id}`,
      type: 'put',
      value: item,
    })),
  ]);
  await database.close();
  console.log(
    `${catalog.label} (${catalog.name}): ${folders.length} папок, ${items.length} предметов → packs/${catalog.name}`,
  );
};

const main = async () => {
  const catalogs = await readCatalogs();

  if (catalogs.length === 0) {
    throw new Error('нет каталогов в data/backgrounds или data/merits-flaws');
  }

  await Promise.all(catalogs.map(catalog => writePack(catalog)));
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

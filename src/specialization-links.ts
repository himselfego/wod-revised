import filter from 'lodash/filter';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import map from 'lodash/map';

import { isActorParent } from './actor-parent';
import { isRecord } from './guards';

const remapSpecializationTargetIds = (
  items: readonly unknown[],
  idMap: ReadonlyMap<string, string>,
): void => {
  for (const raw of items) {
    if (!isRecord(raw) || raw['type'] !== 'specialization') {
      continue;
    }

    const { system } = raw;

    if (!isRecord(system) || system['targetKind'] !== 'secondaryAbility' || !isString(system['targetId'])) {
      continue;
    }

    const next = idMap.get(system['targetId']);

    if (!isNil(next)) {
      system['targetId'] = next;
    }
  }
};

const onDeleteItem = (item: FoundryItem, _options: unknown, userId: unknown): void => {
  if (item.type !== 'secondaryAbility' || !isString(userId) || game.user.id !== userId) {
    return;
  }

  const { parent } = item;

  if (!isActorParent(parent)) {
    return;
  }

  const ids = map(
    filter(parent.items.contents, {
      system: { targetId: item.id, targetKind: 'secondaryAbility' },
      type: 'specialization',
    }),
    'id',
  );

  if (ids.length === 0) {
    return;
  }

  void parent.deleteEmbeddedDocuments('Item', ids);
};

const registerSpecializationLinks = (): void => {
  Hooks.on('deleteItem', onDeleteItem);
};

export {
  registerSpecializationLinks,
  remapSpecializationTargetIds,
};

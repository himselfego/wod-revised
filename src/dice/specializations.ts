import filter from 'lodash/filter';
import find from 'lodash/find';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';
import toLower from 'lodash/toLower';

import { isSpecializationTargetKind } from '../config';
import { isPoolKind, poolKey } from './pool';

interface PoolSpecialization {
  id: string;
  label: string;
}

const poolSpecializations = (
  actor: FoundryActor,
  keys: ReadonlySet<string>,
): PoolSpecialization[] => {
  const owned = filter(actor.items.contents, { type: 'specialization' });
  const matching = filter(owned, (item) => {
    const { targetId, targetKind } = item.system;

    if (!isSpecializationTargetKind(targetKind) || !isPoolKind(targetKind)) {
      return false;
    }

    if (!isString(targetId) || isEmpty(targetId)) {
      return false;
    }

    return keys.has(poolKey(targetKind, targetId));
  });

  return sortBy(
    map(matching, item => ({
      id: item.id,
      label: item.name,
    })),
    spec => toLower(spec.label),
  );
};

const resolvePoolSpecialization = (
  actor: FoundryActor,
  keys: ReadonlySet<string>,
  specializationId: string | undefined,
): PoolSpecialization | undefined => {
  if (isNil(specializationId) || isEmpty(specializationId)) {
    return undefined;
  }

  return find(poolSpecializations(actor, keys), ['id', specializationId]);
};

export type {
  PoolSpecialization,
};
export {
  poolSpecializations,
  resolvePoolSpecialization,
};

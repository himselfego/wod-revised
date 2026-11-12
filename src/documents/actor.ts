import isArray from 'lodash/isArray';
import isBoolean from 'lodash/isBoolean';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';

import { clampMoneyChange, clampWillpowerChange } from '../data/splat/mortal';
import { isRecord } from '../guards';
import { remapSpecializationTargetIds } from '../specialization-links';

const SuperActor = CONFIG.Actor.documentClass;

class WodActor extends SuperActor {
  public override async _preUpdate(
    changed: Record<string, unknown>,
    options: Record<string, unknown>,
    user: unknown,
  ): Promise<boolean> {
    clampMoneyChange(changed);
    clampWillpowerChange(this.system.willpower, changed);

    return super._preUpdate(changed, options, user);
  }

  /**
   * Без `save: true` — копия в памяти, как у Foundry: в базу ничего не пишется.
   */
  public override clone(
    data: Record<string, unknown> = {},
    context: Record<string, unknown> = {},
  ): FoundryActor | Promise<FoundryActor> {
    const hasKeepId = Boolean(context['keepId']);
    const hasKeepEmbeddedIds = isBoolean(context['keepEmbeddedIds']) ? context['keepEmbeddedIds'] : hasKeepId;

    if (hasKeepEmbeddedIds || context['save'] !== true) {
      return super.clone(data, context);
    }

    const source = foundry.utils.mergeObject(this.toObject(), data);
    const { items } = source;

    if (!isArray(items)) {
      return super.clone(data, context);
    }

    const idMap = new Map<string, string>();

    for (const raw of items) {
      if (!isRecord(raw) || !isString(raw['_id']) || isEmpty(raw['_id'])) {
        continue;
      }

      const newId = foundry.utils.randomID();

      idMap.set(raw['_id'], newId);
      raw['_id'] = newId;
    }

    remapSpecializationTargetIds(items, idMap);

    if (!hasKeepId) {
      delete source['_id'];
    }

    return SuperActor.create(source, { ...context, keepEmbeddedIds: true });
  }
}

const registerActorDocument = (): void => {
  CONFIG.Actor.documentClass = WodActor;
};

export {
  registerActorDocument,
  WodActor,
};

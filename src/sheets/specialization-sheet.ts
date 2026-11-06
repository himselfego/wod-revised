import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import map from 'lodash/map';

import { isActorParent } from '../actor-parent';
import {
  ABILITY_CATEGORY_ORDER,
  activeAbilitySet,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_GROUPS,
  parseSpecializationTarget,
} from '../config';
import { isRecord } from '../guards';
import { submitDataWithArtwork } from '../item-artwork';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const isSpecializationTargetLocked = (item: FoundryItem): boolean => isActorParent(item.parent);

const hostLabel = (item: FoundryItem): string => {
  const { targetId, targetKind } = item.system;

  if (targetKind === 'attribute' && isString(targetId)) {
    return game.i18n.localize(`WOD.Attribute.${targetId}`);
  }

  if (targetKind === 'ability' && isString(targetId)) {
    return game.i18n.localize(`WOD.Ability.${targetId}`);
  }

  if (targetKind === 'secondaryAbility' && isString(targetId) && isActorParent(item.parent)) {
    const host = item.parent.items.get(targetId);

    if (!isNil(host)) {
      return host.name;
    }
  }

  return '';
};

const targetGroups = (item: FoundryItem): readonly object[] => {
  const { targetId, targetKind } = item.system;
  const abilities = activeAbilitySet();

  return [
    ...map(ATTRIBUTE_GROUP_ORDER, group => ({
      label: `WOD.AttributeGroup.${group}`,
      options: map(ATTRIBUTE_GROUPS[group], key => ({
        label: `WOD.Attribute.${key}`,
        selected: targetKind === 'attribute' && targetId === key,
        value: `attribute:${key}`,
      })),
    })),
    ...map(ABILITY_CATEGORY_ORDER, category => ({
      label: `WOD.AbilityCategory.${category}`,
      options: map(abilities[category], id => ({
        label: `WOD.Ability.${id}`,
        selected: targetKind === 'ability' && targetId === id,
        value: `ability:${id}`,
      })),
    })),
  ];
};

class SpecializationItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 220, width: 400 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/specialization.hbs' },
  };

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const isTargetLocked = isSpecializationTargetLocked(document);

    return {
      ...context,
      hostLabel: isTargetLocked ? hostLabel(document) : '',
      isTargetLocked,
      item: document,
      targetGroups: isTargetLocked ? [] : targetGroups(document),
    };
  }

  public override async _processSubmitData(
    event: Event,
    form: HTMLFormElement,
    submitData: Record<string, unknown>,
    options?: object,
  ): Promise<unknown> {
    const next: Record<string, unknown> = { ...submitData };
    const parsed = parseSpecializationTarget(next['target']);
    const system = isRecord(next['system']) ? next['system'] : {};

    delete next['target'];

    if (!isSpecializationTargetLocked(this.document) && !isNil(parsed) && parsed.targetKind !== 'secondaryAbility') {
      next['system'] = {
        ...system,
        targetId: parsed.targetId,
        targetKind: parsed.targetKind,
      };
    }

    return super._processSubmitData(event, form, submitDataWithArtwork(this.document, next), options);
  }
}

export {
  isSpecializationTargetLocked,
  SpecializationItemSheet,
};

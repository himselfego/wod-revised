import map from 'lodash/map';

import { ABILITY_CATEGORY_ORDER, TRAIT_MAX } from '../config';
import { submitDataWithArtwork } from '../item-artwork';
import { enrichItemHtml } from './item-enrich';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

export class SecondaryAbilityItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 560, width: 600 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/secondary-ability.hbs' },
  };

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const enrichedDescription = await enrichItemHtml(document, system.description);

    return {
      ...context,
      categories: map(ABILITY_CATEGORY_ORDER, id => ({
        checked: system.category === id,
        id,
        label: `WOD.AbilityCategory.${id}`,
        title: `WOD.AbilityCategory.${id}`,
      })),
      enrichedDescription,
      item: document,
      system,
      valueMax: TRAIT_MAX,
      valueMin: 0,
    };
  }

  public override async _processSubmitData(
    event: Event,
    form: HTMLFormElement,
    submitData: Record<string, unknown>,
    options?: object,
  ): Promise<unknown> {
    return super._processSubmitData(event, form, submitDataWithArtwork(this.document, submitData), options);
  }
}

import map from 'lodash/map';

import { COST_MAX, COST_MIN, MERIT_FLAW_CATEGORY_ORDER } from '../config';
import { submitDataWithArtwork } from '../item-artwork';
import { enrichItemHtml } from './item-enrich';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

export class MeritFlawItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 560, width: 600 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/merit-flaw.hbs' },
  };

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const enrichedDescription = await enrichItemHtml(document, system.description);

    return {
      ...context,
      categories: map(MERIT_FLAW_CATEGORY_ORDER, id => ({
        checked: system.category === id,
        id,
        label: `WOD.CategoryShort.${id}`,
        title: `WOD.Category.${id}`,
      })),
      costMax: COST_MAX,
      costMin: COST_MIN,
      enrichedDescription,
      item: document,
      system,
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

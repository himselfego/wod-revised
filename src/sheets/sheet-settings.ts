import isNil from 'lodash/isNil';
import replace from 'lodash/replace';

const DialogBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const SHOW_SECONDARY_ABILITIES = 'showSecondaryAbilities';

const openSettings = new Map<string, WodSheetSettings>();

/*
 * Нет флага — блок виден, как до настройки.
 * Явный false прячет вторичные. Предметы на акторе остаются.
 */
const shouldShowSecondaryAbilities = (actor: FoundryActor): boolean => (
  actor.getFlag('wod-revised', SHOW_SECONDARY_ABILITIES) !== false
);

const toggleSecondaryAbilities = async function (this: WodSheetSettings, event: Event): Promise<void> {
  event.preventDefault();

  if (!this.actor.isOwner) {
    return;
  }

  await this.actor.setFlag(
    'wod-revised',
    SHOW_SECONDARY_ABILITIES,
    !shouldShowSecondaryAbilities(this.actor),
  );
  await this.render({ force: true });
};

class WodSheetSettings extends DialogBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      toggleSecondaryAbilities,
    },
    classes: ['wod-revised'],
    position: { width: 420 },
    window: {
      resizable: false,
      title: 'WOD.SheetSettings.title',
    },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/actor/sheet-settings.hbs' },
  };

  public readonly actor: FoundryActor;

  public constructor(actor: FoundryActor) {
    // По uuid, не id: у несвязанных токенов одного актёра общий id.
    super({ id: `wod-sheet-settings-${replace(actor.uuid, /\./g, '-')}` });
    this.actor = actor;
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);

    return {
      ...context,
      editable: this.actor.isOwner,
      showSecondaryAbilities: shouldShowSecondaryAbilities(this.actor),
    };
  }

  public override async close(options: object = {}): Promise<this> {
    openSettings.delete(this.actor.uuid);
    await super.close(options);

    return this;
  }
}

const openSheetSettings = (actor: FoundryActor): void => {
  const existing = openSettings.get(actor.uuid);

  if (!isNil(existing)) {
    void existing.render({ force: true });

    return;
  }

  const app = new WodSheetSettings(actor);

  openSettings.set(actor.uuid, app);
  void app.render({ force: true });
};

export {
  openSheetSettings,
  shouldShowSecondaryAbilities,
};

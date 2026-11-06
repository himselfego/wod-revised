import type { SpecializationTargetKind } from '../config';

import every from 'lodash/every';
import filter from 'lodash/filter';
import fromPairs from 'lodash/fromPairs';
import get from 'lodash/get';
import includes from 'lodash/includes';
import indexOf from 'lodash/indexOf';
import isBoolean from 'lodash/isBoolean';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import join from 'lodash/join';
import keys from 'lodash/keys';
import map from 'lodash/map';
import sortBy from 'lodash/sortBy';
import toLower from 'lodash/toLower';

import {
  ABILITY_CATEGORY_ORDER,
  ABILITY_IDS,
  ABILITY_SETS,
  ATTRIBUTE_GROUP_ORDER,
  ATTRIBUTE_GROUPS,
  DEFAULT_ACTOR_IMG,
  HEALTH_ICON,
  HEALTH_LEVELS,
  HUMANITY_MAX,
  isAbilityCategory,
  isAttributeKey,
  isSpecializationTargetKind,
  itemImg,
  MERIT_FLAW_CATEGORY_ORDER,
  MERIT_FLAW_TYPE_ORDER,
  MONEY_ICON,
  packWoundBoxes,
  SPECIALIZATION_MIN_RATING,
  specializationArtworkCategory,
  TRAIT_MAX,
  VIRTUE_IDS,
  WILLPOWER_MAX,
  woundVignette,
} from '../config';
import { secondaryAbilitiesOf, specializationsOf, traitRating } from '../data/traits';
import {
  bindPoolUi,
  cancelPoolItemOpen,
  disposePoolUi,
  openPoolDialog,
  syncPoolAfterTracks,
} from '../dice/sheet';
import { SHEET_PATCH_OPTION, writeElementAttribute } from '../elements/wod-track';
import { isRecord } from '../guards';
import {
  abilityLevelKey,
  abilityLevelText,
  attributeLevelKey,
  attributeLevelText,
} from './ability-levels';
import { formatMoneyInput, moneyCaret, parseMoneyInput } from './money-format';
import { openSheetSettings, shouldShowSecondaryAbilities } from './sheet-settings';

const SheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

const CORE_TRACK_SYSTEM_KEYS = ['abilities', 'attributes', 'health', 'humanity', 'virtues', 'willpower'];

/*
 * `size-2.5` + `gap-0.5` у `wod-dots`. Меняете кружок — правьте и шаг.
 * Скролл вкладки классический, не overlay: без зазора лейблы ряда сжимаются.
 */
const DOT_GAP_PX = 2;
const DOT_PX = 10;
const SCROLLBAR_GUTTER_PX = 16;
const SHEET_MIN_WIDTH_TEN_DOTS = 1008;
const TRAIT_COLUMNS = 3;

const actorSheetMinWidth = (dots: number = TRAIT_MAX): number => (
  SHEET_MIN_WIDTH_TEN_DOTS
  + TRAIT_COLUMNS * (DOT_PX + DOT_GAP_PX) * (dots - 10)
  + SCROLLBAR_GUTTER_PX
);

const SHEET_TAB_GROUP = 'sheet';
const SHEET_TAB_IDS = ['stats', 'advantages', 'status'] as const;
const SHEET_TAB_ICONS = {
  advantages: 'fa-solid fa-scale-balanced',
  stats: 'fa-solid fa-user',
  status: 'fa-solid fa-heart-pulse',
} as const;

const SHARED_PARTIALS: Record<string, string> = {
  'wod-page': 'systems/wod-revised/templates/shared/page.hbs',
};

const ACTOR_PARTIALS: Record<string, string> = {
  'wod-abilities': 'systems/wod-revised/templates/actor/shared/abilities.hbs',
  'wod-attributes': 'systems/wod-revised/templates/actor/shared/attributes.hbs',
  'wod-header': 'systems/wod-revised/templates/actor/shared/header.hbs',
  'wod-health': 'systems/wod-revised/templates/actor/shared/health.hbs',
  'wod-identity': 'systems/wod-revised/templates/actor/shared/identity.hbs',
  'wod-merits-flaws': 'systems/wod-revised/templates/actor/shared/merits-flaws.hbs',
  'wod-portrait': 'systems/wod-revised/templates/actor/shared/portrait.hbs',
  'wod-secondary-abilities': 'systems/wod-revised/templates/actor/shared/secondary-abilities.hbs',
  'wod-soul': 'systems/wod-revised/templates/actor/shared/soul.hbs',
  'wod-specializations': 'systems/wod-revised/templates/actor/shared/specializations.hbs',
  'wod-stat': 'systems/wod-revised/templates/actor/shared/stat.hbs',
  'wod-status': 'systems/wod-revised/templates/actor/shared/status.hbs',
  'wod-status-strip': 'systems/wod-revised/templates/actor/shared/status-strip.hbs',
  'wod-tabs': 'systems/wod-revised/templates/actor/shared/tabs.hbs',
  'wod-willpower': 'systems/wod-revised/templates/actor/shared/willpower.hbs',
};

const prepareSheetTabs = (activeId: string): Record<string, object> => fromPairs(
  map(SHEET_TAB_IDS, (id): [string, object] => [
    id,
    {
      cssClass: id === activeId ? 'active' : '',
      group: SHEET_TAB_GROUP,
      icon: SHEET_TAB_ICONS[id],
      id,
      label: game.i18n.localize(`WOD.Tab.${id}`),
    },
  ]),
);

const MERIT_FLAW_ADD_LABEL = {
  flaw: 'WOD.Action.addFlaw',
  merit: 'WOD.Action.addMerit',
} as const;

const healthTooltip = (level: (typeof HEALTH_LEVELS)[number]): string => {
  const name = game.i18n.localize(`WOD.Health.${level.id}`);

  if (!('penalty' in level)) {
    return name;
  }

  return `${name} (−${level.penalty})`;
};

const healthPenaltyLabel = (level: (typeof HEALTH_LEVELS)[number]): string => {
  if (!('penalty' in level)) {
    return game.i18n.localize('WOD.HealthPenalty.none');
  }

  return `−${level.penalty}`;
};

const prepareHealthLevels = (): readonly object[] => map(HEALTH_LEVELS, level => ({
  descKey: `WOD.HealthDesc.${level.id}`,
  id: level.id,
  labelKey: `WOD.Health.${level.id}`,
  penaltyLabel: healthPenaltyLabel(level),
  title: healthTooltip(level),
}));

const resolveRenderOptions = (options: unknown, extra: unknown): Record<string, unknown> => {
  if (isBoolean(options)) {
    if (isRecord(extra)) {
      return { ...extra, force: options };
    }

    return { force: options };
  }

  if (isRecord(options)) {
    return options;
  }

  return {};
};

const isTrackSystemUpdate = (system: Record<string, unknown>, trackKeys: readonly string[]): boolean => {
  const systemKeys = keys(system);

  return systemKeys.length > 0 && every(systemKeys, key => includes(trackKeys, key));
};

const isTrackOnlyChange = (changed: Record<string, unknown>, trackKeys: readonly string[]): boolean => {
  const extraKeys = filter(keys(changed), key => key !== '_id' && key !== 'system');
  const { system } = changed;

  return extraKeys.length === 0 && isRecord(system) && isTrackSystemUpdate(system, trackKeys);
};

const shouldPatchTracks = (
  options: Record<string, unknown>,
  trackKeys: readonly string[],
): boolean => {
  const renderData = get(options, 'renderData');
  const changed = isRecord(renderData) ? renderData : get(options, 'data');

  if (get(options, 'force') === true) {
    return false;
  }

  if (get(options, SHEET_PATCH_OPTION) === true) {
    return true;
  }

  return isRecord(changed) && isTrackOnlyChange(changed, trackKeys);
};

const categoryRank = (category: string): number => {
  const rank = indexOf(MERIT_FLAW_CATEGORY_ORDER, category);

  if (rank === -1) {
    return MERIT_FLAW_CATEGORY_ORDER.length;
  }

  return rank;
};

const specializationRows = (
  items: ReadonlyArray<WodActorSheet['document']['items']['contents'][number]>,
  targetKind: string,
  targetId: string,
): readonly object[] => map(
  specializationsOf(items, targetKind, targetId),
  item => ({
    id: item.id,
    name: item.name,
  }),
);

const prepareMeritFlawColumns = (
  items: ReadonlyArray<WodActorSheet['document']['items']['contents'][number]>,
): readonly object[] => map(
  MERIT_FLAW_TYPE_ORDER,
  (type) => {
    const owned = filter(items, ['type', type]);

    return {
      addLabel: MERIT_FLAW_ADD_LABEL[type],
      items: map(
        sortBy(owned, [item => categoryRank(item.system.category), item => toLower(item.name)]),
        item => ({
          categoryLabel: `WOD.CategoryShort.${item.system.category}`,
          cost: item.system.cost,
          id: item.id,
          name: item.name,
        }),
      ),
      label: `TYPES.Item.${type}`,
      type,
    };
  },
);

const prepareSecondaryAbilityColumns = (actor: WodActorSheet['document']): readonly object[] => map(
  ABILITY_CATEGORY_ORDER,
  category => ({
    addLabel: 'WOD.Action.addSecondaryAbility',
    category,
    items: map(
      secondaryAbilitiesOf(actor.items.contents, category),
      item => ({
        id: item.id,
        max: TRAIT_MAX,
        name: item.name,
        specializations: specializationRows(actor.items.contents, 'secondaryAbility', item.id),
        uuid: item.uuid,
        value: traitRating(actor, 'secondaryAbility', item.id),
      }),
    ),
    label: `WOD.AbilityCategory.${category}`,
  }),
);

const itemFromTarget = (
  sheet: WodActorSheet,
  target: HTMLElement,
): WodActorSheet['document']['items']['contents'][number] | undefined => {
  const row = target.closest('[data-item-id]');

  if (!(row instanceof HTMLElement)) {
    return undefined;
  }

  const id = row.dataset['itemId'];

  if (isNil(id) || isEmpty(id)) {
    return undefined;
  }

  return sheet.document.items.get(id);
};

const deleteOwnedItem = async (sheet: WodActorSheet, target: HTMLElement): Promise<void> => {
  if (!sheet.isEditable) {
    return;
  }

  const item = itemFromTarget(sheet, target);

  if (isNil(item)) {
    return;
  }

  await item.deleteDialog();
};

const createOwnedItem = async (sheet: WodActorSheet, source: object): Promise<void> => {
  const created = await sheet.document.createEmbeddedDocuments('Item', [source]);
  const [item] = created;

  if (isNil(item)) {
    return;
  }

  await item.sheet.render({ force: true });
};

const isValidSpecializationTarget = (
  sheet: WodActorSheet,
  targetKind: SpecializationTargetKind,
  targetId: string,
): boolean => {
  if (targetKind === 'attribute') {
    return isAttributeKey(targetId);
  }

  if (targetKind === 'ability') {
    return includes(ABILITY_IDS, targetId);
  }

  const host = sheet.document.items.get(targetId);

  return !isNil(host) && host.type === 'secondaryAbility';
};

const specializationSource = (
  sheet: WodActorSheet,
  targetKind: string | undefined,
  targetId: string | undefined,
): object | undefined => {
  if (!isSpecializationTargetKind(targetKind) || isNil(targetId) || isEmpty(targetId)) {
    return undefined;
  }

  if (!isValidSpecializationTarget(sheet, targetKind, targetId)) {
    return undefined;
  }

  if (traitRating(sheet.document, targetKind, targetId) < SPECIALIZATION_MIN_RATING) {
    return undefined;
  }

  const type = 'specialization';
  const img = itemImg(type, specializationArtworkCategory(targetKind, targetId, sheet.document));

  return {
    name: game.i18n.localize(`TYPES.Item.${type}`),
    type,
    ...(!isNil(img) && { img }),
    system: { targetId, targetKind },
  };
};

const traitItemSource = (
  type: 'flaw' | 'merit' | 'secondaryAbility',
  category: string | undefined,
): object | undefined => {
  if (type === 'secondaryAbility' && !isAbilityCategory(category)) {
    return undefined;
  }

  const img = itemImg(type, category);

  return {
    name: game.i18n.localize(`TYPES.Item.${type}`),
    type,
    ...(!isNil(img) && { img }),
    ...(type === 'secondaryAbility' && { system: { category } }),
  };
};

const TRAIT_ITEM_TYPES = ['flaw', 'merit', 'secondaryAbility'] as const;

const isTraitItemType = (value: unknown): value is (typeof TRAIT_ITEM_TYPES)[number] => includes(
  TRAIT_ITEM_TYPES as readonly unknown[],
  value,
);

const ownedTraitSource = (type: string | undefined, category: string | undefined): object | undefined => {
  if (!isTraitItemType(type)) {
    return undefined;
  }

  return traitItemSource(type, category);
};

const createItem = async function (
  this: WodActorSheet,
  event: Event,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();

  if (!this.isEditable) {
    return;
  }

  const { category, targetId, targetKind, type } = target.dataset;
  const source = type === 'specialization'
    ? specializationSource(this, targetKind, targetId)
    : ownedTraitSource(type, category);

  if (isNil(source)) {
    return;
  }

  await createOwnedItem(this, source);
};

const deleteItem = async function (
  this: WodActorSheet,
  event: Event,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  await deleteOwnedItem(this, target);
};

const openItem = async function (
  this: WodActorSheet,
  event: Event,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();

  const isDoubleClick = event instanceof MouseEvent && event.detail > 1;

  if (!isDoubleClick) {
    return;
  }

  cancelPoolItemOpen(this);

  const item = itemFromTarget(this, target);

  if (isNil(item)) {
    return;
  }

  await item.sheet.render({ force: true });
};

const openPool = async function (this: WodActorSheet, event: Event): Promise<void> {
  event.preventDefault();
  await openPoolDialog(this);
};

const sheetSettings = function (this: WodActorSheet, event: Event): void {
  event.preventDefault();

  if (!this.isEditable) {
    return;
  }

  openSheetSettings(this.document);
};

const showPortrait = function (this: WodActorSheet, event: Event): void {
  event.preventDefault();

  const { document } = this;

  new foundry.applications.apps.ImagePopout({
    shareable: true,
    src: document.img,
    uuid: document.uuid,
    window: { title: document.name },
  }).render({ force: true });
};

const registerActorPartials = (): void => {
  void foundry.applications.handlebars.loadTemplates({
    ...SHARED_PARTIALS,
    ...ACTOR_PARTIALS,
  });
};

const syncMoneyInput = (
  input: HTMLInputElement,
  stored: HTMLInputElement,
  shouldKeepCaret: boolean,
): void => {
  const previous = input.value;
  const formatted = formatMoneyInput(previous);
  const start = input.selectionStart ?? previous.length;
  const end = input.selectionEnd ?? start;

  if (previous !== formatted) {
    input.value = formatted;

    if (shouldKeepCaret && document.activeElement === input) {
      input.setSelectionRange(
        moneyCaret(previous, formatted, start),
        moneyCaret(previous, formatted, end),
      );
    }
  }

  stored.value = parseMoneyInput(formatted);
  input.style.width = `${Math.max(formatted.length, 1)}ch`;
};

/*
 * Видимое поле без name: в нём пробелы тысяч.
 * В документ уходит соседнее hidden с голым числом.
 */
const bindMoneyInput = (root: HTMLElement): void => {
  const input = root.querySelector('input.wod-money');
  const stored = root.querySelector('input.wod-money-value');

  if (!(input instanceof HTMLInputElement) || !(stored instanceof HTMLInputElement)) {
    return;
  }

  input.addEventListener('input', () => {
    syncMoneyInput(input, stored, true);
  });
  input.addEventListener('change', () => {
    syncMoneyInput(input, stored, false);
  });
  syncMoneyInput(input, stored, false);
};

const bindSheetMinWidth = (root: HTMLElement): void => {
  root.style.minWidth = `${actorSheetMinWidth()}px`;
};

interface TabScroll {
  id: string;
  top: number;
}

const tabScrolls = new WeakMap<object, TabScroll>();

const captureActiveTabScroll = (root: HTMLElement): TabScroll | undefined => {
  const tab = root.querySelector('.tab.wod-tab.active');

  if (!(tab instanceof HTMLElement)) {
    return undefined;
  }

  const id = tab.dataset['tab'];

  if (isNil(id) || isEmpty(id)) {
    return undefined;
  }

  return { id, top: tab.scrollTop };
};

const restoreActiveTabScroll = (root: HTMLElement, scroll: TabScroll | undefined): void => {
  if (isNil(scroll) || scroll.top === 0) {
    return;
  }

  for (const tab of root.querySelectorAll('.tab.wod-tab')) {
    if (!(tab instanceof HTMLElement) || tab.dataset['tab'] !== scroll.id) {
      continue;
    }

    tab.scrollTop = scroll.top;

    return;
  }
};

const LEVEL_KINDS = ['ability', 'attribute'] as const;

type LevelKind = (typeof LEVEL_KINDS)[number];

const isLevelKind = (value: string | undefined): value is LevelKind => includes(LEVEL_KINDS, value);

const paintTraitLevelTips = (
  root: ParentNode,
  actor: WodActorSheet['document'],
): void => {
  for (const node of root.querySelectorAll('[data-level-kind]')) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const kind = node.dataset['levelKind'];
    const id = node.dataset['levelId'];

    if (!isLevelKind(kind) || isNil(id) || isEmpty(id)) {
      continue;
    }

    const value = traitRating(actor, kind, id);
    const key = kind === 'ability' ? abilityLevelKey(id, value) : attributeLevelKey(id, value);

    if (isNil(key)) {
      delete node.dataset['tooltip'];
      delete node.dataset['tooltipText'];
      continue;
    }

    const text = kind === 'ability' ? abilityLevelText(id, value) : attributeLevelText(id, value);

    writeElementAttribute(node, 'data-tooltip', key);

    if (isNil(text)) {
      delete node.dataset['tooltipText'];
      continue;
    }

    writeElementAttribute(node, 'data-tooltip-text', text);
  }
};

const writeWoundVignette = (root: HTMLElement, boxes: readonly string[]): void => {
  const value = String(woundVignette(boxes));

  for (const portrait of root.querySelectorAll('.wod-portrait')) {
    if (!(portrait instanceof HTMLElement)) {
      continue;
    }

    portrait.style.setProperty('--wod-wound', value);
  }
};

class WodActorSheet extends SheetBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      createItem,
      deleteItem,
      openItem,
      openPool,
      sheetSettings,
      showPortrait,
    },
    classes: ['wod-revised', 'sheet', 'actor'],
    form: { submitOnChange: true },
    position: { height: 880, width: actorSheetMinWidth() },
    window: { resizable: true },
  };

  public static override TABS = {
    [SHEET_TAB_GROUP]: {
      initial: 'stats',
      tabs: map(SHEET_TAB_IDS, id => ({
        id,
        label: `WOD.Tab.${id}`,
      })),
    },
  };

  public override tabGroups: Record<string, string> = {
    [SHEET_TAB_GROUP]: 'stats',
  };

  protected get trackSystemKeys(): readonly string[] {
    return CORE_TRACK_SYSTEM_KEYS;
  }

  public override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
    this._createContextMenu(() => this.getOwnedItemContextOptions(), '[data-item-id]', {
      hookName: 'getWodItemContextOptions',
      parentClassHooks: false,
    });
    bindMoneyInput(this.element);
    bindSheetMinWidth(this.element);
    bindPoolUi(this);

    if (this.element instanceof HTMLElement) {
      restoreActiveTabScroll(this.element, tabScrolls.get(this));
    }
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const abilitySet = ABILITY_SETS[system.abilitySet];

    return {
      ...context,
      abilityColumns: map(ABILITY_CATEGORY_ORDER, category => ({
        category,
        items: map(abilitySet[category], (id) => {
          const value = traitRating(document, 'ability', id);

          return {
            id,
            label: `WOD.Ability.${id}`,
            levelKey: abilityLevelKey(id, value),
            levelTip: abilityLevelText(id, value),
            max: TRAIT_MAX,
            specializations: specializationRows(document.items.contents, 'ability', id),
            value,
          };
        }),
        label: `WOD.AbilityCategory.${category}`,
      })),
      actor: document,
      attributeGroups: map(ATTRIBUTE_GROUP_ORDER, group => ({
        attributes: map(ATTRIBUTE_GROUPS[group], (key) => {
          const value = traitRating(document, 'attribute', key);

          return {
            key,
            label: `WOD.Attribute.${key}`,
            levelKey: attributeLevelKey(key, value),
            levelTip: attributeLevelText(key, value),
            max: TRAIT_MAX,
            specializations: specializationRows(document.items.contents, 'attribute', key),
            value,
          };
        }),
        group,
        label: `WOD.AttributeGroup.${group}`,
      })),
      canRollPool: document.isOwner,
      hasPortrait: document.img !== DEFAULT_ACTOR_IMG && document.img !== '',
      healthIcon: HEALTH_ICON,
      healthLevels: prepareHealthLevels(),
      healthStates: join(packWoundBoxes(system.health.boxes), '|'),
      humanityMax: HUMANITY_MAX,
      meritFlawColumns: prepareMeritFlawColumns(document.items.contents),
      moneyIcon: MONEY_ICON,
      moneyLabel: formatMoneyInput(String(system.money)),
      secondaryAbilityColumns: prepareSecondaryAbilityColumns(document),
      sheetTabs: prepareSheetTabs(get(this.tabGroups, SHEET_TAB_GROUP, 'stats')),
      showSecondaryAbilities: shouldShowSecondaryAbilities(document),
      system,
      virtues: map(VIRTUE_IDS, key => ({
        key,
        label: `WOD.Virtue.${key}`,
        max: TRAIT_MAX,
        value: traitRating(document, 'virtue', key),
      })),
      willpowerMax: WILLPOWER_MAX,
      woundVignette: woundVignette(system.health.boxes),
    };
  }

  public override async _preRender(context: unknown, options: unknown): Promise<void> {
    if (this.rendered && this.element instanceof HTMLElement) {
      const scroll = captureActiveTabScroll(this.element);

      if (isNil(scroll)) {
        tabScrolls.delete(this);
      } else {
        tabScrolls.set(this, scroll);
      }
    }

    await super._preRender(context, options);
  }

  public override async close(options: object = {}): Promise<this> {
    await disposePoolUi(this);
    await super.close(options);

    return this;
  }

  public override async render(options: unknown = {}, extra: unknown = {}): Promise<this> {
    if (this.rendered && shouldPatchTracks(resolveRenderOptions(options, extra), this.trackSystemKeys)) {
      this.syncTracks();

      return this;
    }

    await super.render(options, extra);

    return this;
  }

  public override setPosition(position: object = {}): unknown {
    const next = { ...(position as { height?: number; width?: number }) };
    const minWidth = actorSheetMinWidth();

    if (isNumber(next.width)) {
      next.width = Math.max(minWidth, next.width);
    }

    const placed = super.setPosition(next);

    if (this.element instanceof HTMLElement) {
      bindSheetMinWidth(this.element);
    }

    return placed;
  }

  protected getOwnedItemContextOptions(): object[] {
    return [
      {
        icon: '<i class="fa-solid fa-trash"></i>',
        name: 'DOCUMENT.Delete',
        callback: (target: HTMLElement) => {
          void deleteOwnedItem(this, target);
        },
        condition: () => this.isEditable,
      },
    ];
  }

  protected syncTracks(): void {
    const { document, element } = this;
    const { system } = document;
    const healthStates = join(packWoundBoxes(system.health.boxes), '|');
    const permanent = String(system.willpower.permanent);
    const temporary = String(system.willpower.temporary);

    writeWoundVignette(element, system.health.boxes);

    for (const health of element.querySelectorAll('wod-health')) {
      writeElementAttribute(health, 'states', healthStates);
    }

    for (const willpower of element.querySelectorAll('wod-willpower')) {
      writeElementAttribute(willpower, 'permanent', permanent);
      writeElementAttribute(willpower, 'temporary', temporary);
    }

    for (const dots of element.querySelectorAll('wod-dots')) {
      const name = dots.getAttribute('name');

      if (isNil(name) || isEmpty(name)) {
        continue;
      }

      const uuid = dots.getAttribute('document-uuid');
      const source = isNil(uuid) || isEmpty(uuid) || uuid === document.uuid
        ? document
        : foundry.utils.fromUuidSync(uuid);

      if (isNil(source)) {
        continue;
      }

      writeElementAttribute(dots, 'value', String(Number(get(source, name, 0))));
    }

    paintTraitLevelTips(element, document);
    syncPoolAfterTracks(this);
  }
}

export {
  registerActorPartials,
  WodActorSheet,
};

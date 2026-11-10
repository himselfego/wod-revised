import fromPairs from 'lodash/fromPairs';
import isNil from 'lodash/isNil';
import map from 'lodash/map';

import { COST_MAX, COST_MIN, DIFFICULTY_MAX, DIFFICULTY_MIN, MERIT_FLAW_CATEGORY_ORDER } from '../config';
import { readRollModifiers, ROLL_MODIFIER_LIMITS } from '../data/feature/roll-modifier';
import { modifierSummary, targetGroups, targetLabel } from '../dice/modifier-labels';
import { isRecord } from '../guards';
import { submitDataWithArtwork } from '../item-artwork';
import { enrichItemHtml } from './item-enrich';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const NUMBER_FIELDS = ['dice', 'difficulty', 'successes', 'setDifficulty', 'variable'] as const;

const BLANK_MODIFIER = {
  dice: 0,
  difficulty: 0,
  ignoreWounds: false,
  setDifficulty: '',
  successes: 0,
  targets: [],
  variable: '',
};

const inputIn = (row: Element, field: string): HTMLInputElement | undefined => {
  const input = row.querySelector(`[data-field="${CSS.escape(field)}"]`);

  return input instanceof HTMLInputElement ? input : undefined;
};

const tagTargets = (row: Element): Array<string | undefined> => map(
  [...row.querySelectorAll('.wod-mods__tag')],
  tag => (tag instanceof HTMLElement ? tag.dataset['target'] : undefined),
);

/**
 * Строки редактора в сыром виде; чистит их `readRollModifiers`.
 */
const readModifierRows = (root: ParentNode): Array<Record<string, unknown>> => map(
  [...root.querySelectorAll('.wod-mods__row')],
  row => ({
    ...fromPairs(map(NUMBER_FIELDS, field => [field, inputIn(row, field)?.value ?? ''])),
    ignoreWounds: inputIn(row, 'ignoreWounds')?.checked === true,
    targets: tagTargets(row),
  }),
);

const blankModifierRow = (root: HTMLElement): HTMLElement | undefined => {
  const template = root.querySelector('template.wod-mods__blank');

  if (!(template instanceof HTMLTemplateElement)) {
    return undefined;
  }

  const node = template.content.firstElementChild?.cloneNode(true);

  return node instanceof HTMLElement ? node : undefined;
};

const targetTag = (target: string, label: string, removeLabel: string): HTMLElement => {
  const tag = document.createElement('span');
  const remove = document.createElement('button');

  tag.className = 'wod-mods__tag';
  tag.dataset['target'] = target;
  tag.textContent = label;
  remove.className = 'wod-mods__tag-remove';
  remove.type = 'button';
  remove.dataset['action'] = 'removeModifierTarget';
  remove.title = removeLabel;
  remove.setAttribute('aria-label', removeLabel);
  remove.textContent = '×';
  tag.append(remove);

  return tag;
};

const isTagged = (row: Element, target: string): boolean => !isNil(
  row.querySelector(`.wod-mods__tag[data-target="${CSS.escape(target)}"]`),
);

/**
 * Выбор в «+ Цель…» превращается в метку; повтор той же цели игнорируется.
 */
const onTargetPicked = (event: Event): void => {
  const select = event.target;

  if (!(select instanceof HTMLSelectElement) || !select.classList.contains('wod-mods__add-target')) {
    return;
  }

  const { value } = select;
  const row = select.closest('.wod-mods__row');
  const tags = row?.querySelector('.wod-mods__tags');

  select.value = '';

  if (!value || isNil(row) || isNil(tags) || isTagged(row, value)) {
    return;
  }

  tags.append(targetTag(value, targetLabel(value), game.i18n.localize('WOD.Modifier.removeTarget')));
};

const addModifier = function (this: MeritFlawItemSheet, event: Event): void {
  event.preventDefault();

  const list = this.element.querySelector('.wod-mods__list');
  const row = blankModifierRow(this.element);

  if (!this.isEditable || isNil(list) || isNil(row)) {
    return;
  }

  list.append(row);
  row.querySelector('select')?.focus();
  row.scrollIntoView({ block: 'nearest' });
};

const deleteModifier = function (this: MeritFlawItemSheet, event: Event, target: HTMLElement): void {
  event.preventDefault();

  if (this.isEditable) {
    target.closest('.wod-mods__row')?.remove();
  }
};

const removeModifierTarget = function (this: MeritFlawItemSheet, event: Event, target: HTMLElement): void {
  event.preventDefault();

  if (this.isEditable) {
    target.closest('.wod-mods__tag')?.remove();
  }
};

export class MeritFlawItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      addModifier,
      deleteModifier,
      removeModifierTarget,
    },
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 760, width: 600 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/merit-flaw.hbs' },
  };

  public override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
    this.element.querySelector('.wod-mods__list')?.addEventListener('change', onTargetPicked);
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const enrichedDescription = await enrichItemHtml(document, system.description);
    const modifiers = readRollModifiers(system.modifiers);

    return {
      ...context,
      blankModifier: BLANK_MODIFIER,
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
      modifierLimits: { ...ROLL_MODIFIER_LIMITS, difficultyMax: DIFFICULTY_MAX, difficultyMin: DIFFICULTY_MIN },
      modifiers: map(modifiers, modifier => ({
        ...modifier,
        setDifficulty: modifier.setDifficulty || '',
        summary: modifierSummary(modifier),
        targets: map(modifier.targets, id => ({ id, label: targetLabel(id) })),
        variable: modifier.variable || '',
      })),
      showModifiers: this.isEditable || modifiers.length > 0,
      system,
      targetGroups: this.isEditable ? targetGroups() : [],
    };
  }

  public override async _processSubmitData(
    event: Event,
    form: HTMLFormElement,
    submitData: Record<string, unknown>,
    options?: object,
  ): Promise<unknown> {
    if (!this.isEditable || isNil(form.querySelector('.wod-mods__list'))) {
      return super._processSubmitData(event, form, submitDataWithArtwork(this.document, submitData), options);
    }

    const system = isRecord(submitData['system']) ? submitData['system'] : {};

    return super._processSubmitData(
      event,
      form,
      submitDataWithArtwork(this.document, {
        ...submitData,
        system: { ...system, modifiers: readRollModifiers(readModifierRows(form)) },
      }),
      options,
    );
  }
}

import type { PowerLevel } from '../data/feature/power';

import compact from 'lodash/compact';
import filter from 'lodash/filter';
import find from 'lodash/find';
import isArray from 'lodash/isArray';
import isFinite from 'lodash/isFinite';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import map from 'lodash/map';
import replace from 'lodash/replace';
import size from 'lodash/size';
import times from 'lodash/times';
import trim from 'lodash/trim';
import values from 'lodash/values';

import { POWER_FAMILY_ORDER } from '../config';
import { isRecord } from '../guards';
import { submitDataWithArtwork } from '../item-artwork';
import { enrichItemHtml } from './item-enrich';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const isLevel = (value: unknown): value is PowerLevel => {
  if (isNil(value) || !isObject(value)) {
    return false;
  }

  return 'description' in value
    && isString(value.description)
    && 'name' in value
    && isString(value.name)
    && 'rank' in value
    && isNumber(value.rank);
};

const readLevels = (value: unknown): PowerLevel[] => {
  if (!isArray(value)) {
    return [];
  }

  return compact(map(value, (entry: unknown) => (isLevel(entry) ? entry : undefined)));
};

const readNumber = (value: unknown, fallback: number): number => {
  const next = Number(value);

  return isFinite(next) ? next : fallback;
};

const asHtml = (value: string): string => {
  const trimmed = trim(value);

  if (!trimmed) {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return `<p>${replace(trimmed, /\n/g, '<br>')}</p>`;
};

const unwrapLevelText = (html: string): string => {
  const trimmed = trim(html);
  const match = /^<p\b[^>]*>([\s\S]*)<\/p>$/i.exec(trimmed);

  if (isNil(match)) {
    return html;
  }

  const inner = match[1] ?? '';

  if (/<(?:p|table|ul|ol|h[1-6]|div)\b/i.test(inner)) {
    return html;
  }

  return replace(inner, /<br\s*\/?>/gi, '\n');
};

const submittedLevelEntries = (value: unknown): unknown[] => {
  if (isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    return values(value);
  }

  return [];
};

const readSubmittedLevels = (value: unknown): PowerLevel[] => map(
  filter(submittedLevelEntries(value), isRecord),
  (entry, index) => {
    const { description, name } = entry;

    return {
      description: isString(description) ? asHtml(description) : '',
      name: isString(name) ? trim(name) : '',
      rank: index + 1,
    };
  },
);

const levelListOf = (root: ParentNode): HTMLOListElement | undefined => {
  const list = root.querySelector('.wod-levels__list');

  return list instanceof HTMLOListElement ? list : undefined;
};

const maxInputOf = (root: ParentNode): HTMLInputElement | undefined => {
  const input = root.querySelector('input[name="system.max"]');

  return input instanceof HTMLInputElement ? input : undefined;
};

const valueInputOf = (root: ParentNode): HTMLInputElement | undefined => {
  const input = root.querySelector('input[name="system.value"]');

  return input instanceof HTMLInputElement ? input : undefined;
};

const levelRowsOf = (list: HTMLOListElement): HTMLElement[] => compact(
  map([...list.children], node => (node instanceof HTMLElement ? node : undefined)),
);

const paintPips = (pips: HTMLElement, rank: number, cap: number): void => {
  pips.replaceChildren(...times(cap, (index) => {
    const pip = document.createElement('span');

    pip.className = index < rank ? 'wod-levels__pip is-filled' : 'wod-levels__pip';
    pip.setAttribute('aria-hidden', 'true');

    return pip;
  }));
};

const syncLevelRows = (root: HTMLElement): void => {
  const list = levelListOf(root);

  if (isNil(list)) {
    return;
  }

  const rows = levelRowsOf(list);
  const storedMax = readNumber(maxInputOf(root)?.value, 1);
  const cap = Math.max(1, storedMax, size(rows));
  const current = readNumber(valueInputOf(root)?.value, 0);
  const valueInput = valueInputOf(root);

  if (!isNil(valueInput)) {
    valueInput.max = String(storedMax);
  }

  for (const [index, row] of rows.entries()) {
    const rank = index + 1;
    const description = row.querySelector('.wod-levels__text');
    const name = row.querySelector('.wod-levels__name');
    const pips = row.querySelector('.wod-levels__pips');

    if (pips instanceof HTMLElement) {
      paintPips(pips, rank, cap);
    }

    if (name instanceof HTMLInputElement) {
      name.name = `system.levels.${index}.name`;
    }

    if (description instanceof HTMLTextAreaElement) {
      description.name = `system.levels.${index}.description`;
    }

    row.classList.toggle('is-current', rank === current);
  }
};

const levelRowFrom = (target: EventTarget | null, list: HTMLOListElement): HTMLElement | undefined => {
  if (!(target instanceof HTMLElement) || !list.contains(target)) {
    return undefined;
  }

  const row = target.closest('.wod-levels__row');

  if (!(row instanceof HTMLElement) || !list.contains(row)) {
    return undefined;
  }

  return row;
};

const levelRowFromHandle = (target: EventTarget | null, list: HTMLOListElement): HTMLElement | undefined => {
  if (!(target instanceof HTMLElement)) {
    return undefined;
  }

  const handle = target.closest('.wod-levels__pips--handle');

  return isNil(handle) ? undefined : levelRowFrom(handle, list);
};

const disarmLevelRows = (list: HTMLOListElement): void => {
  for (const row of levelRowsOf(list)) {
    row.removeAttribute('draggable');
    row.classList.remove('is-dragging');
  }
};

const placeLevelRow = (list: HTMLOListElement, dragging: HTMLElement, clientY: number): void => {
  const before = find(
    filter(levelRowsOf(list), row => row !== dragging),
    (row) => {
      const rect = row.getBoundingClientRect();

      return clientY <= rect.top + (rect.height / 2);
    },
  );

  if (isNil(before)) {
    if (list.lastElementChild !== dragging) {
      list.append(dragging);
    }

    return;
  }

  if (before.previousElementSibling !== dragging) {
    before.before(dragging);
  }
};

const bindLevelSort = (root: HTMLElement): void => {
  const list = levelListOf(root);

  if (isNil(list)) {
    return;
  }

  let dragging: HTMLElement | undefined;

  const endDrag = (): void => {
    disarmLevelRows(list);
    dragging = undefined;
    syncLevelRows(root);
  };

  list.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    const row = levelRowFromHandle(event.target, list);

    if (isNil(row)) {
      return;
    }

    row.draggable = true;
    document.addEventListener('pointerup', () => {
      if (isNil(dragging)) {
        disarmLevelRows(list);
      }
    }, { once: true });
  });

  list.addEventListener('dragstart', (event) => {
    const row = levelRowFrom(event.target, list);

    if (isNil(row) || !row.draggable) {
      event.preventDefault();

      return;
    }

    const { dataTransfer } = event;

    dragging = row;
    row.classList.add('is-dragging');
    event.stopPropagation();

    if (!isNil(dataTransfer)) {
      dataTransfer.setData('text/plain', 'level-row');
    }
  });

  list.addEventListener('dragover', (event) => {
    if (isNil(dragging)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    placeLevelRow(list, dragging, event.clientY);
  });

  list.addEventListener('drop', (event) => {
    if (isNil(dragging)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  });

  list.addEventListener('dragend', endDrag);
};

const bindLevelEditor = (root: HTMLElement, isEditable: boolean): void => {
  if (isNil(levelListOf(root))) {
    return;
  }

  const onSync = (): void => {
    syncLevelRows(root);
  };

  const maxInput = maxInputOf(root);
  const valueInput = valueInputOf(root);

  if (!isNil(maxInput)) {
    maxInput.addEventListener('input', onSync);
  }

  if (!isNil(valueInput)) {
    valueInput.addEventListener('input', onSync);
  }

  if (isEditable) {
    bindLevelSort(root);
  }
};

const blankLevelRow = (root: HTMLElement): HTMLElement | undefined => {
  const template = root.querySelector('template.wod-levels__blank');

  if (!(template instanceof HTMLTemplateElement)) {
    return undefined;
  }

  const node = template.content.firstElementChild?.cloneNode(true);

  return node instanceof HTMLElement ? node : undefined;
};

const addLevel = function (this: PowerItemSheet, event: Event): void {
  event.preventDefault();

  if (!this.isEditable) {
    return;
  }

  const { element } = this;
  const list = levelListOf(element);
  const row = blankLevelRow(element);

  if (isNil(list) || isNil(row)) {
    return;
  }

  list.append(row);
  syncLevelRows(element);

  const name = row.querySelector('.wod-levels__name');

  if (name instanceof HTMLInputElement) {
    name.focus();
  }

  row.scrollIntoView({ block: 'nearest' });
};

const deleteLevel = function (this: PowerItemSheet, event: Event, target: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();

  if (!this.isEditable) {
    return;
  }

  const row = target.closest('.wod-levels__row');

  if (!(row instanceof HTMLElement)) {
    return;
  }

  row.remove();
  syncLevelRows(this.element);
};

export class PowerItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      addLevel,
      deleteLevel,
    },
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 840, width: 600 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/power.hbs' },
  };

  public override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
    bindLevelEditor(this.element, this.isEditable);
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const cap = Number(system.max);
    const value = Number(system.value);
    const levels = readLevels(system.levels);
    const pipCap = Math.max(1, cap, size(levels));
    const enrichedDescription = await enrichItemHtml(document, system.description);
    const enrichedMechanics = await enrichItemHtml(document, system.mechanics);
    const preparedLevels = await Promise.all(map(levels, async entry => ({
      current: Number(entry.rank) === value,
      description: unwrapLevelText(entry.description),
      enrichedDescription: await enrichItemHtml(document, entry.description),
      name: entry.name,
      pips: times(pipCap, index => ({ filled: index < Number(entry.rank) })),
      rank: entry.rank,
    })));

    return {
      ...context,
      enrichedDescription,
      enrichedMechanics,
      families: map(POWER_FAMILY_ORDER, id => ({
        checked: system.family === id,
        id,
        label: `WOD.Family.${id}`,
      })),
      item: document,
      levels: preparedLevels,
      showLevels: this.isEditable || levels.length > 0,
      showMechanics: this.isEditable || Boolean(system.mechanics),
      system,
      valueMax: cap,
      valueMin: 0,
    };
  }

  public override async _processSubmitData(
    event: Event,
    form: HTMLFormElement,
    submitData: Record<string, unknown>,
    options?: object,
  ): Promise<unknown> {
    const shouldWriteLevels = this.isEditable && !isNil(form.querySelector('.wod-levels'));

    if (!shouldWriteLevels) {
      return super._processSubmitData(event, form, submitDataWithArtwork(this.document, submitData), options);
    }

    const system = isRecord(submitData['system']) ? submitData['system'] : {};
    const levels = readSubmittedLevels(system['levels']);

    return super._processSubmitData(
      event,
      form,
      submitDataWithArtwork(this.document, {
        ...submitData,
        system: {
          ...system,
          levels,
          max: Math.max(1, readNumber(system['max'], 1)),
        },
      }),
      options,
    );
  }
}

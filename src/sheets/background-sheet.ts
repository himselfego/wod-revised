import type { BackgroundStep } from '../data/feature/background';

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

import { isRecord } from '../guards';
import { submitDataWithArtwork } from '../item-artwork';
import { enrichItemHtml } from './item-enrich';

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const hasHtml = (value: unknown): boolean => {
  if (!isString(value)) {
    return false;
  }

  return Boolean(trim(replace(replace(value, /<[^>]*>/g, ''), /&nbsp;|&#160;|\u{A0}/giu, ' ')));
};

const isStep = (value: unknown): value is BackgroundStep => {
  if (isNil(value) || !isObject(value)) {
    return false;
  }

  return 'description' in value && isString(value.description) && 'rank' in value && isNumber(value.rank);
};

const readSteps = (value: unknown): BackgroundStep[] => {
  if (!isArray(value)) {
    return [];
  }

  return compact(map(value, (entry: unknown) => (isStep(entry) ? entry : undefined)));
};

const readNumber = (value: unknown, fallback: number): number => {
  const next = Number(value);

  return isFinite(next) ? next : fallback;
};

const submittedStepEntries = (value: unknown): unknown[] => {
  if (isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    return values(value);
  }

  return [];
};

const readSubmittedSteps = (value: unknown): BackgroundStep[] => map(
  map(
    filter(submittedStepEntries(value), isRecord),
    (entry) => {
      const { description } = entry;

      return isString(description) ? description : '';
    },
  ),
  (description, index) => ({
    description,
    rank: index + 1,
  }),
);

const stepListOf = (root: ParentNode): HTMLOListElement | undefined => {
  const list = root.querySelector('.wod-steps__list');

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

const stepRowsOf = (list: HTMLOListElement): HTMLElement[] => compact(
  map([...list.children], node => (node instanceof HTMLElement ? node : undefined)),
);

const paintPips = (pips: HTMLElement, rank: number, cap: number): void => {
  pips.replaceChildren(...times(cap, (index) => {
    const pip = document.createElement('span');

    pip.className = index < rank ? 'wod-steps__pip is-filled' : 'wod-steps__pip';
    pip.setAttribute('aria-hidden', 'true');

    return pip;
  }));
};

const syncStepRows = (root: HTMLElement): void => {
  const list = stepListOf(root);

  if (isNil(list)) {
    return;
  }

  const rows = stepRowsOf(list);
  const storedMax = readNumber(maxInputOf(root)?.value, 1);
  const cap = Math.max(1, storedMax, size(rows));
  const current = readNumber(valueInputOf(root)?.value, 0);
  const valueInput = valueInputOf(root);

  if (!isNil(valueInput)) {
    valueInput.max = String(storedMax);
  }

  for (const [index, row] of rows.entries()) {
    const rank = index + 1;
    const description = row.querySelector('.wod-steps__text');
    const pips = row.querySelector('.wod-steps__pips');

    if (pips instanceof HTMLElement) {
      paintPips(pips, rank, cap);
    }

    if (description instanceof HTMLTextAreaElement) {
      description.name = `system.steps.${index}.description`;
    }

    row.classList.toggle('is-current', rank === current);
  }
};

const stepRowFrom = (target: EventTarget | null, list: HTMLOListElement): HTMLElement | undefined => {
  if (!(target instanceof HTMLElement) || !list.contains(target)) {
    return undefined;
  }

  const row = target.closest('.wod-steps__row');

  if (!(row instanceof HTMLElement) || !list.contains(row)) {
    return undefined;
  }

  return row;
};

const stepRowFromHandle = (target: EventTarget | null, list: HTMLOListElement): HTMLElement | undefined => {
  if (!(target instanceof HTMLElement)) {
    return undefined;
  }

  const handle = target.closest('.wod-steps__pips--handle');

  return isNil(handle) ? undefined : stepRowFrom(handle, list);
};

const disarmStepRows = (list: HTMLOListElement): void => {
  for (const row of stepRowsOf(list)) {
    row.removeAttribute('draggable');
    row.classList.remove('is-dragging');
  }
};

const placeStepRow = (list: HTMLOListElement, dragging: HTMLElement, clientY: number): void => {
  const before = find(
    filter(stepRowsOf(list), row => row !== dragging),
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

const bindStepSort = (root: HTMLElement): void => {
  const list = stepListOf(root);

  if (isNil(list)) {
    return;
  }

  let dragging: HTMLElement | undefined;

  const endDrag = (): void => {
    disarmStepRows(list);
    dragging = undefined;
    syncStepRows(root);
  };

  list.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    const row = stepRowFromHandle(event.target, list);

    if (isNil(row)) {
      return;
    }

    row.draggable = true;
    document.addEventListener('pointerup', () => {
      if (isNil(dragging)) {
        disarmStepRows(list);
      }
    }, { once: true });
  });

  list.addEventListener('dragstart', (event) => {
    const row = stepRowFrom(event.target, list);

    if (isNil(row) || !row.draggable) {
      event.preventDefault();

      return;
    }

    const { dataTransfer } = event;

    dragging = row;
    row.classList.add('is-dragging');
    event.stopPropagation();

    if (!isNil(dataTransfer)) {
      dataTransfer.setData('text/plain', 'step-row');
    }
  });

  list.addEventListener('dragover', (event) => {
    if (isNil(dragging)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    placeStepRow(list, dragging, event.clientY);
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

const bindStepEditor = (root: HTMLElement, isEditable: boolean): void => {
  if (isNil(stepListOf(root))) {
    return;
  }

  const onSync = (): void => {
    syncStepRows(root);
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
    bindStepSort(root);
  }
};

const blankStepRow = (root: HTMLElement): HTMLElement | undefined => {
  const template = root.querySelector('template.wod-steps__blank');

  if (!(template instanceof HTMLTemplateElement)) {
    return undefined;
  }

  const node = template.content.firstElementChild?.cloneNode(true);

  return node instanceof HTMLElement ? node : undefined;
};

const addStep = function (this: BackgroundItemSheet, event: Event): void {
  event.preventDefault();

  if (!this.isEditable) {
    return;
  }

  const { element } = this;
  const list = stepListOf(element);
  const row = blankStepRow(element);

  if (isNil(list) || isNil(row)) {
    return;
  }

  const maxInput = maxInputOf(element);
  const nextRank = size(stepRowsOf(list)) + 1;

  list.append(row);

  if (!isNil(maxInput) && readNumber(maxInput.value, 1) < nextRank) {
    maxInput.value = String(nextRank);
  }

  syncStepRows(element);

  const description = row.querySelector('.wod-steps__text');

  if (description instanceof HTMLTextAreaElement) {
    description.focus();
  }

  row.scrollIntoView({ block: 'nearest' });
};

const revealEditor = function (this: BackgroundItemSheet, event: Event, target: HTMLElement): void {
  event.preventDefault();

  if (!this.isEditable) {
    return;
  }

  const editor = target.closest('.wod-editor');

  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const body = editor.querySelector('.wod-editor__body');

  editor.classList.remove('is-collapsed');
  target.remove();

  if (body instanceof HTMLElement) {
    body.hidden = false;
  }

  requestAnimationFrame(() => {
    const surface = editor.querySelector<HTMLElement>('.ProseMirror');

    if (!isNil(surface)) {
      surface.focus();
    }
  });
};

const deleteStep = function (this: BackgroundItemSheet, event: Event, target: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();

  if (!this.isEditable) {
    return;
  }

  const row = target.closest('.wod-steps__row');

  if (!(row instanceof HTMLElement)) {
    return;
  }

  row.remove();
  syncStepRows(this.element);
};

export class BackgroundItemSheet extends ItemSheetBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      addStep,
      deleteStep,
      revealEditor,
    },
    classes: ['wod-revised', 'sheet', 'item'],
    form: { closeOnSubmit: true, submitOnChange: false },
    position: { height: 760, width: 600 },
    window: { resizable: true },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/feature/background.hbs' },
  };

  public override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
    bindStepEditor(this.element, this.isEditable);
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { document } = this;
    const { system } = document;
    const cap = Number(system.max);
    const value = Number(system.value);
    const steps = readSteps(system.steps);
    const enrichedDescription = await enrichItemHtml(document, system.description);
    const enrichedMechanics = await enrichItemHtml(document, system.mechanics);
    const hasDescription = hasHtml(system.description);
    const hasMechanics = hasHtml(system.mechanics);

    return {
      ...context,
      collapsedDescription: this.isEditable && !hasDescription,
      collapsedMechanics: this.isEditable && !hasMechanics,
      enrichedDescription,
      enrichedMechanics,
      item: document,
      showDescription: this.isEditable || hasDescription,
      showMechanics: this.isEditable || hasMechanics,
      showSteps: this.isEditable || steps.length > 0,
      steps: map(steps, entry => ({
        current: Number(entry.rank) === value,
        description: entry.description,
        pips: times(cap, index => ({ filled: index < Number(entry.rank) })),
        rank: entry.rank,
      })),
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
    const shouldWriteSteps = this.isEditable && !isNil(form.querySelector('.wod-steps'));

    if (!shouldWriteSteps) {
      return super._processSubmitData(event, form, submitDataWithArtwork(this.document, submitData), options);
    }

    const system = isRecord(submitData['system']) ? submitData['system'] : {};
    const steps = readSubmittedSteps(system['steps']);

    return super._processSubmitData(
      event,
      form,
      submitDataWithArtwork(this.document, {
        ...submitData,
        system: {
          ...system,
          max: Math.max(1, readNumber(system['max'], 1), size(steps)),
          steps,
        },
      }),
      options,
    );
  }
}

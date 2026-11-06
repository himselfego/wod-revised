import type { WodActorSheet } from '../sheets/wod-sheet';
import type { PoolHost } from './pool';

import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';

import { registerChatPortrait } from './chat';
import { WodPoolDialog } from './dialog';
import { isPoolKind, poolKey, prunePoolKeys } from './pool';

const DBLCLICK_MS = 250;

const pools = new WeakMap<object, Set<string>>();
const dialogs = new WeakMap<object, WodPoolDialog>();
const listeners = new WeakMap<object, AbortController>();
const pendingToggles = new WeakMap<object, ReturnType<typeof setTimeout>>();

const sheetPool = (sheet: WodActorSheet): Set<string> => {
  const existing = pools.get(sheet);

  if (!isNil(existing)) {
    return existing;
  }

  const next = new Set<string>();

  pools.set(sheet, next);

  return next;
};

const cancelPendingToggle = (sheet: WodActorSheet): void => {
  const handle = pendingToggles.get(sheet);

  if (isNil(handle)) {
    return;
  }

  clearTimeout(handle);
  pendingToggles.delete(sheet);
};

const syncPoolOpenButton = (sheet: WodActorSheet, canRoll: boolean, size: number): void => {
  const open = sheet.element.querySelector('.wod-pool-open');

  if (!(open instanceof HTMLElement)) {
    return;
  }

  open.hidden = !canRoll || size === 0;
};

const syncPoolHighlights = (sheet: WodActorSheet): void => {
  if (!(sheet.element instanceof HTMLElement)) {
    return;
  }

  const pool = sheetPool(sheet);
  const canRoll = sheet.document.isOwner;

  prunePoolKeys(sheet.document, pool);

  for (const node of sheet.element.querySelectorAll('[data-pool-kind]')) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const kind = node.dataset['poolKind'];
    const id = node.dataset['poolId'];
    const isSelected = canRoll
      && isPoolKind(kind)
      && !isNil(id)
      && !isEmpty(id)
      && pool.has(poolKey(kind, id));

    node.classList.toggle('is-poolable', canRoll);
    node.classList.toggle('is-pooled', isSelected);

    if (canRoll) {
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      continue;
    }

    if (!isNil(node.dataset['action'])) {
      continue;
    }

    node.removeAttribute('role');
    node.removeAttribute('tabindex');
  }

  syncPoolOpenButton(sheet, canRoll, pool.size);
};

const refreshPoolUi = (sheet: WodActorSheet): void => {
  syncPoolHighlights(sheet);

  const dialog = dialogs.get(sheet);

  if (!isNil(dialog) && dialog.rendered && !dialog.closing) {
    void dialog.render();
  }
};

const togglePoolKey = (sheet: WodActorSheet, key: string): void => {
  const pool = sheetPool(sheet);

  if (pool.has(key)) {
    pool.delete(key);
  } else {
    pool.add(key);
  }

  refreshPoolUi(sheet);
};

const scheduleToggle = (sheet: WodActorSheet, key: string): void => {
  cancelPendingToggle(sheet);

  const handle = setTimeout(() => {
    pendingToggles.delete(sheet);
    togglePoolKey(sheet, key);
  }, DBLCLICK_MS);

  pendingToggles.set(sheet, handle);
};

const poolKeyFromTarget = (target: HTMLElement): string | undefined => {
  const kind = target.dataset['poolKind'];
  const id = target.dataset['poolId'];

  if (!isPoolKind(kind) || isNil(id) || isEmpty(id)) {
    return undefined;
  }

  return poolKey(kind, id);
};

const poolTargetFromEvent = (sheet: WodActorSheet, event: Event): HTMLElement | undefined => {
  const { target } = event;

  if (!(target instanceof HTMLElement)) {
    return undefined;
  }

  if (!isNil(target.closest('.wod-add, .wod-trait__delete, wod-dots'))) {
    return undefined;
  }

  const name = target.closest('[data-pool-kind]');

  if (!(name instanceof HTMLElement) || !sheet.element.contains(name)) {
    return undefined;
  }

  return name;
};

const onPoolPointer = (sheet: WodActorSheet, event: Event): void => {
  if (!sheet.document.isOwner) {
    return;
  }

  const name = poolTargetFromEvent(sheet, event);

  if (isNil(name)) {
    return;
  }

  const key = poolKeyFromTarget(name);

  if (isNil(key)) {
    return;
  }

  const isMouse = event instanceof MouseEvent;

  if (isMouse && event.detail > 1) {
    cancelPendingToggle(sheet);

    return;
  }

  if (event instanceof KeyboardEvent) {
    event.preventDefault();
  }

  if (isMouse && name.dataset['action'] === 'openItem') {
    scheduleToggle(sheet, key);

    return;
  }

  togglePoolKey(sheet, key);
};

const onPoolClick = (sheet: WodActorSheet, event: Event): void => {
  onPoolPointer(sheet, event);
};

const onPoolKey = (sheet: WodActorSheet, event: Event): void => {
  if (!(event instanceof KeyboardEvent)) {
    return;
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  onPoolPointer(sheet, event);
};

const hostFor = (sheet: WodActorSheet): PoolHost => ({
  document: sheet.document,
  clearPool: (): void => {
    sheetPool(sheet).clear();
    syncPoolHighlights(sheet);
  },
  onDialogClosed: (): void => {
    dialogs.delete(sheet);
  },
  poolKeys: (): ReadonlySet<string> => sheetPool(sheet),
  removePoolKey: (key: string): void => {
    sheetPool(sheet).delete(key);
    refreshPoolUi(sheet);
  },
});

export const bindPoolUi = (sheet: WodActorSheet): void => {
  listeners.get(sheet)?.abort();

  const next = new AbortController();
  const { signal } = next;

  listeners.set(sheet, next);
  sheet.element.addEventListener('click', (event) => {
    onPoolClick(sheet, event);
  }, { signal });
  sheet.element.addEventListener('keydown', (event) => {
    onPoolKey(sheet, event);
  }, { signal });
  syncPoolHighlights(sheet);
};

export const cancelPoolItemOpen = (sheet: WodActorSheet): void => {
  cancelPendingToggle(sheet);
};

export const disposePoolUi = async (sheet: WodActorSheet): Promise<void> => {
  cancelPendingToggle(sheet);
  listeners.get(sheet)?.abort();
  listeners.delete(sheet);

  const dialog = dialogs.get(sheet);

  if (isNil(dialog)) {
    return;
  }

  await dialog.close();
};

export const openPoolDialog = async (sheet: WodActorSheet): Promise<void> => {
  if (!sheet.document.isOwner || sheetPool(sheet).size === 0) {
    return;
  }

  const existing = dialogs.get(sheet);

  if (!isNil(existing) && !existing.closing) {
    await existing.render({ force: true });

    return;
  }

  const dialog = new WodPoolDialog(hostFor(sheet));

  dialogs.set(sheet, dialog);
  await dialog.render({ force: true });
};

export const registerDice = (): void => {
  registerChatPortrait();
  void foundry.applications.handlebars.loadTemplates({
    'wod-formula': 'systems/wod-revised/templates/dice/formula.hbs',
  });
  void foundry.applications.handlebars.loadTemplates([
    'systems/wod-revised/templates/chat/pool-roll.hbs',
    'systems/wod-revised/templates/dice/pool-dialog.hbs',
  ]);
};

export const syncPoolAfterTracks = (sheet: WodActorSheet): void => {
  refreshPoolUi(sheet);
};

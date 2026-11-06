import filter from 'lodash/filter';
import flatMap from 'lodash/flatMap';
import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isBoolean from 'lodash/isBoolean';
import isInteger from 'lodash/isInteger';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import map from 'lodash/map';
import some from 'lodash/some';

import { isRecord } from '../../guards';
import {
  isWoundStatusEffectId,
  WOUND_LEVEL_IDS,
  WOUND_STATUS_IMG,
  woundLevel,
  woundStatusEffectId,
} from './wound';

const WOUND_SYNC = 'wodWoundSync';

const woundSyncTails = new Map<string, Promise<void>>();

const woundWriteOptions = (isAnimated: boolean): Record<string, unknown> => ({
  animate: isAnimated,
  [WOUND_SYNC]: true,
});

/**
 * Foundry 14 `CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS`.
 * Без длительности токен иначе не рисует иконку.
 */
const SHOW_ICON_ALWAYS = 2 as const;

interface WoundEffectSource {
  changes: [];
  description: string;
  disabled: false;
  flags: {
    'wod-revised': {
      wound: true;
    };
  };
  img: string;
  name: string;
  showIcon: typeof SHOW_ICON_ALWAYS;
  statuses: [string];
}

interface WoundWriteState {
  changes: readonly unknown[];
  disabled: boolean;
  img: string;
  showIcon: number;
  statuses: readonly string[];
}

const isFoundryActor = (value: unknown): value is FoundryActor => {
  if (!isObject(value) || !('documentName' in value) || value.documentName !== 'Actor') {
    return false;
  }

  return 'effects' in value && 'id' in value && 'system' in value;
};

const isWoundSync = (options: unknown): boolean => isRecord(options) && options[WOUND_SYNC] === true;

const statusIds = (statuses: unknown): string[] => {
  if (statuses instanceof Set) {
    return filter([...statuses], isString);
  }

  if (isArray(statuses)) {
    return filter(statuses, isString);
  }

  return [];
};

const changeList = (changes: unknown): readonly unknown[] => {
  if (isArray(changes)) {
    return changes;
  }

  return [];
};

const hasWoundFlag = (flags: unknown): boolean => {
  if (!isRecord(flags)) {
    return false;
  }

  const scope = flags['wod-revised'];

  if (!isRecord(scope)) {
    return false;
  }

  return scope['wound'] === true;
};

const isWoundMarked = (effect: FoundryActiveEffect): boolean => {
  if (effect.getFlag('wod-revised', 'wound') === true) {
    return true;
  }

  return some(statusIds(effect.statuses), isWoundStatusEffectId);
};

const isIncomingWound = (effect: FoundryActiveEffect, data: Record<string, unknown>): boolean => {
  if (isWoundMarked(effect) || hasWoundFlag(data['flags'])) {
    return true;
  }

  return some(statusIds(data['statuses']), isWoundStatusEffectId);
};

const healthBoxes = (actor: FoundryActor): readonly string[] => {
  const boxes: unknown = get(actor.system, 'health.boxes');

  if (!isArray(boxes)) {
    return [];
  }

  return filter(boxes, isString);
};

const actorParent = (effect: FoundryActiveEffect): FoundryActor | undefined => {
  if (!isFoundryActor(effect.parent)) {
    return undefined;
  }

  return effect.parent;
};

const showIconValue = (value: unknown, fallback: number): number => {
  if (isNumber(value) && isInteger(value)) {
    return value;
  }

  return fallback;
};

const createState = (effect: FoundryActiveEffect, data: Record<string, unknown>): WoundWriteState => ({
  changes: changeList(Object.hasOwn(data, 'changes') ? data['changes'] : effect.changes),
  disabled: isBoolean(data['disabled']) ? data['disabled'] : effect.disabled,
  img: isString(data['img']) ? data['img'] : effect.img,
  showIcon: showIconValue(data['showIcon'], effect.showIcon),
  statuses: statusIds(Object.hasOwn(data, 'statuses') ? data['statuses'] : effect.statuses),
});

const isAllowedWoundState = (actor: FoundryActor, state: WoundWriteState): boolean => {
  const level = woundLevel(healthBoxes(actor));

  if (level === undefined) {
    return false;
  }

  const [only] = state.statuses;

  return state.statuses.length === 1
    && only === woundStatusEffectId(level.id)
    && state.changes.length === 0
    && !state.disabled
    && state.img === WOUND_STATUS_IMG[level.id]
    && state.showIcon === SHOW_ICON_ALWAYS;
};

const canWriteWoundEffect = (effect: FoundryActiveEffect, data: Record<string, unknown>): boolean => {
  const actor = actorParent(effect);

  if (actor === undefined) {
    return false;
  }

  return isAllowedWoundState(actor, createState(effect, data));
};

const woundEffectSource = (level: NonNullable<ReturnType<typeof woundLevel>>): WoundEffectSource => ({
  changes: [],
  description: game.i18n.localize(`WOD.HealthDesc.${level.id}`),
  disabled: false,
  flags: { 'wod-revised': { wound: true } },
  img: WOUND_STATUS_IMG[level.id],
  name: game.i18n.localize(`WOD.Health.${level.id}`),
  showIcon: SHOW_ICON_ALWAYS,
  statuses: [woundStatusEffectId(level.id)],
});

const isSameWoundEffect = (effect: FoundryActiveEffect, source: WoundEffectSource): boolean => {
  const [only] = statusIds(effect.statuses);
  const [expected] = source.statuses;

  return effect.name === source.name
    && effect.img === source.img
    && effect.showIcon === source.showIcon
    && !effect.disabled
    && changeList(effect.changes).length === 0
    && effect.getFlag('wod-revised', 'wound') === true
    && statusIds(effect.statuses).length === 1
    && only === expected;
};

const deleteWoundEffects = async (
  actor: FoundryActor,
  effects: readonly FoundryActiveEffect[],
  isAnimated: boolean,
): Promise<void> => {
  if (effects.length === 0) {
    return;
  }

  await actor.deleteEmbeddedDocuments('ActiveEffect', map(effects, 'id'), woundWriteOptions(isAnimated));
};

const syncWoundEffect = async (actor: FoundryActor): Promise<void> => {
  const level = woundLevel(healthBoxes(actor));
  const existing = filter(actor.effects.contents, isWoundMarked);

  if (level === undefined) {
    await deleteWoundEffects(actor, existing, true);

    return;
  }

  const source = woundEffectSource(level);
  const [primary, ...extras] = existing;

  await deleteWoundEffects(actor, extras, false);

  if (primary === undefined) {
    await actor.createEmbeddedDocuments('ActiveEffect', [source], woundWriteOptions(true));

    return;
  }

  if (isSameWoundEffect(primary, source)) {
    return;
  }

  const [only] = statusIds(primary.statuses);
  const [expected] = source.statuses;
  const hasLevelChanged = statusIds(primary.statuses).length !== 1 || only !== expected;

  await actor.updateEmbeddedDocuments('ActiveEffect', [{ ...source, _id: primary.id }], woundWriteOptions(false));

  if (hasLevelChanged) {
    primary._displayScrollingStatus(true);
  }
};

const reportWoundSync = (error: unknown): void => {
  console.error(error);
};

const runWoundSync = async (actor: FoundryActor, previous: Promise<void>): Promise<void> => {
  await previous;

  try {
    await syncWoundEffect(actor);
  } catch (error: unknown) {
    reportWoundSync(error);
  }
};

/**
 * Одна очередь на актора. Параллельные синхронизации создают два эффекта,
 * и Foundry пишет имя уровня над токеном отдельно для каждого.
 */
const queueWoundSync = (actor: FoundryActor): void => {
  const previous = woundSyncTails.get(actor.uuid) ?? Promise.resolve();
  const task = runWoundSync(actor, previous);

  woundSyncTails.set(actor.uuid, task);
};

const isCurrentUser = (userId: unknown): boolean => isString(userId) && game.user.id === userId;

const hasHealthBoxesChanged = (changes: Record<string, unknown>): boolean => {
  if (Object.hasOwn(changes, 'system.health.boxes')) {
    return true;
  }

  const { system } = changes;

  if (!isRecord(system)) {
    return false;
  }

  const { health } = system;

  if (!isRecord(health)) {
    return false;
  }

  return Object.hasOwn(health, 'boxes');
};

const onCreateActor = (
  actor: FoundryActor,
  _data: Record<string, unknown>,
  _options: Record<string, unknown>,
  userId: string,
): void => {
  if (isCurrentUser(userId)) {
    queueWoundSync(actor);
  }
};

const onUpdateActor = (
  actor: FoundryActor,
  changes: Record<string, unknown>,
  _options: Record<string, unknown>,
  userId: string,
): void => {
  if (isCurrentUser(userId) && hasHealthBoxesChanged(changes)) {
    queueWoundSync(actor);
  }
};

const onCreateToken = (
  token: FoundryTokenDocument,
  _data: Record<string, unknown>,
  _options: Record<string, unknown>,
  userId: string,
): void => {
  if (isCurrentUser(userId) && !token.actorLink && token.actor !== null) {
    queueWoundSync(token.actor);
  }
};

const onReady = (): void => {
  if (!game.user.isGM) {
    return;
  }

  const unlinked = flatMap(game.scenes.contents, scene => map(
    filter(scene.tokens.contents, { actorLink: false }),
    'actor',
  ));

  for (const actor of [...game.actors.contents, ...filter(unlinked, isFoundryActor)]) {
    queueWoundSync(actor);
  }
};

const onPreCreateActiveEffect = (
  effect: FoundryActiveEffect,
  data: Record<string, unknown>,
  options: Record<string, unknown>,
): boolean | undefined => {
  if (isWoundSync(options) || !isIncomingWound(effect, data)) {
    return undefined;
  }

  if (canWriteWoundEffect(effect, data)) {
    return undefined;
  }

  return false;
};

const onPreUpdateActiveEffect = (
  effect: FoundryActiveEffect,
  changes: Record<string, unknown>,
  options: Record<string, unknown>,
): boolean | undefined => {
  const isMarked = isWoundMarked(effect)
    || hasWoundFlag(changes['flags'])
    || some(statusIds(changes['statuses']), isWoundStatusEffectId);

  if (!isMarked || isWoundSync(options)) {
    return undefined;
  }

  if (canWriteWoundEffect(effect, changes)) {
    return undefined;
  }

  return false;
};

const onPreDeleteActiveEffect = (
  effect: FoundryActiveEffect,
  _data: Record<string, unknown>,
  options: Record<string, unknown>,
): boolean | undefined => {
  if (isWoundSync(options) || !isWoundMarked(effect)) {
    return undefined;
  }

  const actor = actorParent(effect);

  if (actor !== undefined && woundLevel(healthBoxes(actor)) === undefined) {
    return undefined;
  }

  return false;
};

const hudRoot = (html: unknown): HTMLElement | undefined => {
  if (html instanceof HTMLElement) {
    return html;
  }

  if (!isObject(html) || !('0' in html)) {
    return undefined;
  }

  const node = html[0];

  if (node instanceof HTMLElement) {
    return node;
  }

  return undefined;
};

const hideWoundStatuses = (_hud: unknown, html: unknown): void => {
  const root = hudRoot(html);

  if (root === undefined) {
    return;
  }

  for (const node of root.querySelectorAll('[data-status-id]')) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const { statusId } = node.dataset;

    if (statusId !== undefined && isWoundStatusEffectId(statusId)) {
      node.remove();
    }
  }
};

const woundStatusEffectConfigs = (): Array<{ hud: false; id: string; img: string; name: string }> => [...map(
  WOUND_LEVEL_IDS,
  id => ({
    hud: false as const,
    id: woundStatusEffectId(id),
    img: WOUND_STATUS_IMG[id],
    name: `WOD.Health.${id}`,
  }),
)];

const registerStatusEffects = (): void => {
  const known = new Set(map(CONFIG.statusEffects, 'id'));
  const additions = filter(woundStatusEffectConfigs(), config => !known.has(config.id));

  CONFIG.statusEffects = [...CONFIG.statusEffects, ...additions];
};

const registerWoundEffects = (): void => {
  registerStatusEffects();
  Hooks.on('createActor', onCreateActor);
  Hooks.on('createToken', onCreateToken);
  Hooks.on('preCreateActiveEffect', onPreCreateActiveEffect);
  Hooks.on('preDeleteActiveEffect', onPreDeleteActiveEffect);
  Hooks.on('preUpdateActiveEffect', onPreUpdateActiveEffect);
  Hooks.on('ready', onReady);
  Hooks.on('renderTokenHUD', hideWoundStatuses);
  Hooks.on('renderTokenHUDHTML', hideWoundStatuses);
  Hooks.on('updateActor', onUpdateActor);
};

export { registerWoundEffects };

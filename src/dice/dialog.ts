import type { FormulaView } from './formula';
import type { ActiveModifier, ModifierChoice } from './modifiers';
import type { PoolHost, PoolPart } from './pool';
import type { RollWound } from './wound';

import filter from 'lodash/filter';
import find from 'lodash/find';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import map from 'lodash/map';
import reject from 'lodash/reject';
import replace from 'lodash/replace';
import some from 'lodash/some';

import { DIFFICULTIES, DIFFICULTY_DEFAULT, isDifficulty } from '../config';
import { formulaView, parsePoolAdjust } from './formula';
import { modifierSummary } from './modifier-labels';
import { modifierAmount, modifierChoices, resolveActiveModifiers } from './modifiers';
import { resolvePoolParts } from './pool';
import { canSpendWillpower, rollPool } from './roll';
import { poolSpecializations, resolvePoolSpecialization } from './specializations';
import { hasUnskilledKnowledge, resolveUnskilled, shouldShowSkillPenalty } from './unskilled';
import { rollWound } from './wound';

const DialogBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const setDifficulty = function (this: WodPoolDialog, event: Event, target: HTMLElement): void {
  event.preventDefault();

  const next = Number(target.dataset['difficulty']);

  if (!isDifficulty(next) || next === this.difficulty) {
    return;
  }

  this.difficulty = next;
  void this.render({ force: true });
};

const toggleSpecialization = function (this: WodPoolDialog, event: Event, target: HTMLElement): void {
  event.preventDefault();

  const next = target.dataset['specialization'];

  if (isNil(next) || isEmpty(next)) {
    return;
  }

  this.specializationId = next === this.specializationId ? undefined : next;
  void this.render({ force: true });
};

const toggleUnskilledKnowledge = function (this: WodPoolDialog, event: Event): void {
  event.preventDefault();

  this.isUnskilledKnowledgeAllowed = !this.isUnskilledKnowledgeAllowed;
  void this.render({ force: true });
};

const toggleWillpower = function (this: WodPoolDialog, event: Event): void {
  event.preventDefault();

  if (!canSpendWillpower(this.host.document)) {
    this.willSpendWillpower = false;
    void this.render({ force: true });

    return;
  }

  this.willSpendWillpower = !this.willSpendWillpower;
  void this.render({ force: true });
};

interface DialogRollState {
  active: ActiveModifier[];
  canSpend: boolean;
  choices: ModifierChoice[];
  keys: ReadonlySet<string>;
  parts: PoolPart[];
  spec: ReturnType<typeof resolvePoolSpecialization>;
  unskilled: ReturnType<typeof resolveUnskilled>;
  view: FormulaView;
  willSpendWillpower: boolean;
  wound: RollWound;
}

const rollState = (dialog: WodPoolDialog): DialogRollState => {
  const keys = dialog.host.poolKeys();
  const parts = resolvePoolParts(dialog.host.document, keys);
  const wound = rollWound(dialog.host.document.system.health.boxes);
  const unskilled = resolveUnskilled(parts, dialog.isUnskilledKnowledgeAllowed);
  const spec = resolvePoolSpecialization(dialog.host.document, keys, dialog.specializationId);
  const canSpend = canSpendWillpower(dialog.host.document);
  const willSpendWillpower = canSpend && dialog.willSpendWillpower;
  const choices = modifierChoices(dialog.host.document.items.contents, parts);
  const active = resolveActiveModifiers(choices, dialog.modifierAmounts);
  const view = formulaView({
    adjust: dialog.adjust,
    bonusLabel: game.i18n.localize('WOD.Roll.bonus'),
    declared: dialog.difficulty,
    modifiers: active,
    parts,
    penalty: unskilled?.penalty ?? 0,
    penaltyLabel: game.i18n.localize('WOD.Roll.penalty'),
    specialization: spec?.label,
    willSpendWillpower,
    woundLabel: isNil(wound.labelKey) ? undefined : game.i18n.localize(wound.labelKey),
    woundPenalty: wound.penalty,
  });

  return {
    active,
    canSpend,
    choices,
    keys,
    parts,
    spec,
    unskilled,
    view,
    willSpendWillpower,
    wound,
  };
};

const toggleModifier = function (this: WodPoolDialog, event: Event, target: HTMLElement): void {
  event.preventDefault();

  const key = target.dataset['modifier'];

  if (isNil(key) || isEmpty(key)) {
    return;
  }

  if (this.modifierAmounts.has(key)) {
    this.modifierAmounts.delete(key);
  } else {
    this.modifierAmounts.set(key, 1);
  }

  void this.render({ force: true });
};

const stepModifier = function (this: WodPoolDialog, event: Event, target: HTMLElement): void {
  event.preventDefault();

  const key = target.dataset['modifier'];
  const choice = find(rollState(this).choices, ['key', key]);

  if (isNil(key) || isNil(choice) || !this.modifierAmounts.has(key)) {
    return;
  }

  const step = Number(target.dataset['step']) || 0;

  this.modifierAmounts.set(key, modifierAmount(choice.modifier, (this.modifierAmounts.get(key) ?? 1) + step));
  void this.render({ force: true });
};

const toggleOtherModifiers = function (this: WodPoolDialog, event: Event): void {
  event.preventDefault();

  this.isShowingOtherModifiers = !this.isShowingOtherModifiers;
  void this.render({ force: true });
};

const modifierView = (choice: ModifierChoice, selection: ReadonlyMap<string, number>): Record<string, unknown> => {
  const isSelected = selection.has(choice.key);
  const amount = modifierAmount(choice.modifier, selection.get(choice.key));
  const { variable } = choice.modifier;

  return {
    amount,
    canDecrease: amount > 1,
    canIncrease: amount < variable,
    detail: modifierSummary(choice.modifier, isSelected ? amount : 1),
    isVariable: isSelected && variable > 0,
    key: choice.key,
    label: choice.label,
    selected: isSelected,
  };
};

/**
 * Подходящие к пулу — сверху; остальные свёрнуты, но включённые из них всегда видны.
 */
const modifierSections = (dialog: WodPoolDialog, choices: readonly ModifierChoice[]): Record<string, unknown> => {
  const others = reject(choices, 'relevant');
  const isShowingOthers = dialog.isShowingOtherModifiers
    || some(others, other => dialog.modifierAmounts.has(other.key));

  return {
    hasModifiers: !isEmpty(choices),
    otherModifiers: isShowingOthers ? map(others, choice => modifierView(choice, dialog.modifierAmounts)) : [],
    otherModifiersLabel: isShowingOthers
      ? game.i18n.localize('WOD.Roll.hideOtherTraits')
      : game.i18n.format('WOD.Roll.otherTraits', { n: others.length }),
    otherModifiersToggle: !isEmpty(others),
    relevantModifiers: map(filter(choices, 'relevant'), choice => modifierView(choice, dialog.modifierAmounts)),
    showOtherModifiers: isShowingOthers,
  };
};

const restoreAdjustFocus = (dialog: WodPoolDialog, caret: number | undefined): void => {
  const input = dialog.element.querySelector('.wod-pool__adjust-input');

  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.focus();
  const pos = caret ?? input.value.length;

  input.setSelectionRange(pos, pos);
};

const paintFormula = (dialog: WodPoolDialog): void => {
  const { view } = rollState(dialog);
  const pool = dialog.element.querySelector('.wod-formula__pool');
  const hasFormula = !isEmpty(view.formula);

  if (!hasFormula || !(pool instanceof HTMLElement)) {
    const input = dialog.element.querySelector('.wod-pool__adjust-input');
    const caret = input instanceof HTMLInputElement ? input.selectionStart ?? undefined : undefined;

    void dialog.render({ force: true }).then(() => {
      restoreAdjustFocus(dialog, caret);
    });

    return;
  }

  pool.textContent = view.formula;
  const dice = dialog.element.querySelector('.wod-formula__dice');

  if (dice instanceof HTMLElement) {
    dice.textContent = `${view.poolTotal}d10`;
  }
};

const onAdjustInput = function (this: WodPoolDialog, input: HTMLInputElement): void {
  this.adjustText = input.value;

  const next = parsePoolAdjust(input.value);

  if (isNil(next) || next === this.adjust) {
    return;
  }

  this.adjust = next;
  paintFormula(this);
};

const submitPool = async function (this: WodPoolDialog, event: Event): Promise<void> {
  event.preventDefault();

  const { active, unskilled, view, wound } = rollState(this);

  if (this.closing || unskilled?.blocked || wound.blocked || isEmpty(view.formula)) {
    return;
  }

  // Флаг ставится до первого await: второй клик до закрытия не бросает ещё раз.
  this.closing = true;

  try {
    await rollPool({
      actor: this.host.document,
      bonus: this.adjust,
      difficulty: this.difficulty,
      isUnskilledKnowledgeAllowed: this.isUnskilledKnowledgeAllowed,
      keys: this.host.poolKeys(),
      modifiers: active,
      specializationId: this.specializationId,
      willSpendWillpower: this.willSpendWillpower,
    });
  } finally {
    await this.close();
  }
};

export class WodPoolDialog extends DialogBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      setDifficulty,
      stepModifier,
      submitPool,
      toggleModifier,
      toggleOtherModifiers,
      toggleSpecialization,
      toggleUnskilledKnowledge,
      toggleWillpower,
    },
    classes: ['wod-revised'],
    position: { width: 450 },
    window: {
      resizable: false,
      title: 'WOD.Action.roll',
    },
  };

  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/dice/pool-dialog.hbs' },
  };

  public adjust = 0;
  public adjustText = '';
  public closing = false;
  public difficulty = DIFFICULTY_DEFAULT;
  public readonly host: PoolHost;
  public isShowingOtherModifiers = false;
  public isUnskilledKnowledgeAllowed = false;
  /**
   * Включённые модификаторы черт: ключ `предмет:индекс` → величина. Новый диалог начинает с пустого.
   */
  public readonly modifierAmounts = new Map<string, number>();
  public specializationId: string | undefined = undefined;
  public willSpendWillpower = false;

  public constructor(host: PoolHost) {
    // По uuid, не id: у несвязанных токенов одного актёра общий id.
    super({ id: `wod-pool-${replace(host.document.uuid, /\./g, '-')}` });
    this.host = host;
  }

  public override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);

    const input = this.element.querySelector('.wod-pool__adjust-input');

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.addEventListener('input', () => {
      onAdjustInput.call(this, input);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    });
  }

  public override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const {
      canSpend,
      choices,
      keys,
      parts,
      spec,
      unskilled,
      view,
      willSpendWillpower,
      wound,
    } = rollState(this);

    return {
      ...context,
      ...view,
      ...modifierSections(this, choices),
      adjustText: this.adjustText,
      blocked: (unskilled?.blocked ?? false) || wound.blocked,
      canSpendWillpower: canSpend,
      difficulties: map(DIFFICULTIES, value => ({
        selected: value === this.difficulty,
        value,
      })),
      difficulty: this.difficulty,
      hasUnskilledKnowledge: hasUnskilledKnowledge(parts),
      isIncapacitated: wound.blocked,
      isUnskilledBlocked: unskilled?.blocked ?? false,
      isUnskilledKnowledgeAllowed: this.isUnskilledKnowledgeAllowed,
      shouldShowSkillPenalty: shouldShowSkillPenalty(this.difficulty, unskilled),
      specializations: map(poolSpecializations(this.host.document, keys), option => ({
        label: option.label,
        selected: option.id === spec?.id,
        value: option.id,
      })),
      willSpendWillpower,
    };
  }

  public override async close(options: object = {}): Promise<this> {
    this.closing = true;
    this.host.clearPool();
    await super.close(options);
    this.host.onDialogClosed();

    return this;
  }

  public override async render(options?: unknown, extra?: unknown): Promise<this> {
    const input = this.rendered
      ? this.element.querySelector('.wod-pool__adjust-input')
      : undefined;
    const shouldRestoreFocus = input instanceof HTMLInputElement && document.activeElement === input;
    const caret = shouldRestoreFocus ? input.selectionStart ?? undefined : undefined;
    const rendered = await super.render(options, extra);

    if (shouldRestoreFocus) {
      restoreAdjustFocus(this, caret);
    }

    return rendered;
  }
}

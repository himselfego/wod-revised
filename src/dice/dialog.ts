import type { FormulaView } from './formula';
import type { PoolHost, PoolPart } from './pool';
import type { RollWound } from './wound';

import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import map from 'lodash/map';

import { DIFFICULTIES, DIFFICULTY_DEFAULT, isDifficulty } from '../config';
import { formulaView, parsePoolAdjust } from './formula';
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
  canSpend: boolean;
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
  const view = formulaView({
    adjust: dialog.adjust,
    bonusLabel: game.i18n.localize('WOD.Roll.bonus'),
    declared: dialog.difficulty,
    parts,
    penalty: unskilled?.penalty ?? 0,
    penaltyLabel: game.i18n.localize('WOD.Roll.penalty'),
    specialization: spec?.label,
    willSpendWillpower,
    woundLabel: isNil(wound.labelKey) ? undefined : game.i18n.localize(wound.labelKey),
    woundPenalty: wound.penalty,
  });

  return {
    canSpend,
    keys,
    parts,
    spec,
    unskilled,
    view,
    willSpendWillpower,
    wound,
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

  const { unskilled, view, wound } = rollState(this);

  if (unskilled?.blocked || wound.blocked || isEmpty(view.formula)) {
    return;
  }

  await rollPool({
    actor: this.host.document,
    bonus: this.adjust,
    difficulty: this.difficulty,
    isUnskilledKnowledgeAllowed: this.isUnskilledKnowledgeAllowed,
    keys: this.host.poolKeys(),
    specializationId: this.specializationId,
    willSpendWillpower: this.willSpendWillpower,
  });
  await this.close();
};

export class WodPoolDialog extends DialogBase {
  public static override DEFAULT_OPTIONS = {
    actions: {
      setDifficulty,
      submitPool,
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
  public isUnskilledKnowledgeAllowed = false;
  public specializationId: string | undefined = undefined;
  public willSpendWillpower = false;

  public constructor(host: PoolHost) {
    super({ id: `wod-pool-${host.document.id}` });
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

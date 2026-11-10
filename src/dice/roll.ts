import type { FormulaView } from './formula';
import type { ActiveModifier } from './modifiers';

import concat from 'lodash/concat';
import filter from 'lodash/filter';
import flatMap from 'lodash/flatMap';
import isNil from 'lodash/isNil';
import map from 'lodash/map';
import reject from 'lodash/reject';
import size from 'lodash/size';

import { DIFFICULTY_DEFAULT, isDifficulty } from '../config';
import { formulaView } from './formula';
import { resolvePoolOutcome } from './outcome';
import { resolvePoolParts } from './pool';
import { resolvePoolSpecialization } from './specializations';
import { resolveUnskilled, shouldShowSkillPenalty } from './unskilled';
import { rollWound } from './wound';

const CHAT_TEMPLATE = 'systems/wod-revised/templates/chat/pool-roll.hbs';

interface RollPoolInput {
  actor: FoundryActor;
  bonus?: number;
  difficulty?: number;
  isUnskilledKnowledgeAllowed?: boolean;
  keys: Iterable<string>;
  modifiers?: readonly ActiveModifier[];
  specializationId?: string;
  willSpendWillpower?: boolean;
}

const facesFromRoll = (roll: Roll): number[] => flatMap(
  roll.terms,
  (term) => {
    const { results } = term;

    if (isNil(results)) {
      return [];
    }

    return map(reject(results, { active: false }), 'result');
  },
);

const tenCount = (faces: readonly number[]): number => size(filter(faces, face => face === 10));

/**
 * Каждая волна — следующий `rollOrder`.
 * Dice So Nice проигрывает их отдельными бросками в том же сообщении. Пул остаётся на 0.
 */
const explodeFromTens = async (
  tens: number,
  rollOrder = 1,
): Promise<{ faces: number[]; rolls: Roll[] }> => {
  if (tens < 1) {
    return {
      faces: [],
      rolls: [],
    };
  }

  const roll = new Roll(`${tens}d10`);

  roll.options = { rollOrder };
  await roll.evaluate();

  const faces = facesFromRoll(roll);
  const nested = await explodeFromTens(tenCount(faces), rollOrder + 1);

  return {
    faces: concat(faces, nested.faces),
    rolls: concat([roll], nested.rolls),
  };
};

const chatContext = (
  view: FormulaView,
  faces: readonly number[],
  extraFaces: readonly number[],
  hasSkillPenalty: boolean,
): Record<string, unknown> => {
  const { dice, extraDice, successes, verdict } = resolvePoolOutcome(
    faces,
    view.effectiveDifficulty,
    view.willSpendWillpower,
    extraFaces,
    view.autoSuccesses,
  );

  return {
    ...view,
    dice,
    difficulty: view.effectiveDifficulty,
    extraDice,
    isBotch: verdict === 'botch',
    isFailure: verdict === 'failure',
    shouldShowSkillPenalty: hasSkillPenalty,
    successes,
  };
};

const canSpendWillpower = (actor: FoundryActor): boolean => actor.system.willpower.temporary >= 1;

const didSpendTemporaryWillpower = async (actor: FoundryActor): Promise<boolean> => {
  const { temporary } = actor.system.willpower;

  if (temporary < 1) {
    return false;
  }

  await actor.update({
    system: {
      willpower: {
        temporary: temporary - 1,
      },
    },
  });

  return true;
};

const rollPool = async ({
  actor,
  bonus = 0,
  difficulty = DIFFICULTY_DEFAULT,
  isUnskilledKnowledgeAllowed = false,
  keys,
  modifiers = [],
  specializationId,
  willSpendWillpower = false,
}: RollPoolInput): Promise<void> => {
  const poolKeys = new Set(keys);
  const parts = resolvePoolParts(actor, poolKeys);
  const unskilled = resolveUnskilled(parts, isUnskilledKnowledgeAllowed);
  const wound = rollWound(actor.system.health.boxes);

  if (unskilled?.blocked || wound.blocked) {
    return;
  }

  const declared = isDifficulty(difficulty) ? difficulty : DIFFICULTY_DEFAULT;
  const penalty = unskilled?.penalty ?? 0;
  const spec = resolvePoolSpecialization(actor, poolKeys, specializationId);
  const isSpent = willSpendWillpower ? await didSpendTemporaryWillpower(actor) : false;
  const view = formulaView({
    adjust: bonus,
    bonusLabel: game.i18n.localize('WOD.Roll.bonus'),
    declared,
    modifiers,
    parts,
    penalty,
    penaltyLabel: game.i18n.localize('WOD.Roll.penalty'),
    specialization: spec?.label,
    willSpendWillpower: isSpent,
    woundLabel: isNil(wound.labelKey) ? undefined : game.i18n.localize(wound.labelKey),
    woundPenalty: wound.penalty,
  });
  const roll = new Roll(`${view.poolTotal}d10`);

  await roll.evaluate();

  const faces = facesFromRoll(roll);
  const exploded = isNil(spec) ? { faces: [], rolls: [] } : await explodeFromTens(tenCount(faces));
  const content = await foundry.applications.handlebars.renderTemplate(
    CHAT_TEMPLATE,
    chatContext(view, faces, exploded.faces, shouldShowSkillPenalty(declared, unskilled)),
  );

  await ChatMessage.create({
    content,
    rolls: concat([roll], exploded.rolls),
    sound: CONFIG.sounds.dice,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
};

export {
  canSpendWillpower,
  rollPool,
};

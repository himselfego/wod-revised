import { WodActorSheet } from './wod-sheet';

export class MortalActorSheet extends WodActorSheet {
  public static override PARTS = {
    body: { template: 'systems/wod-revised/templates/actor/mortal.hbs' },
  };
}

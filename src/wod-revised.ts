import './styles/wod-revised.css';

import { WOD } from './config';
import { BackgroundDataModel } from './data/feature/background';
import { MeritFlawDataModel } from './data/feature/merit-flaw';
import { PowerDataModel } from './data/feature/power';
import { SecondaryAbilityDataModel } from './data/feature/secondary-ability';
import { SpecializationDataModel } from './data/feature/specialization';
import { MortalDataModel } from './data/splat/mortal';
import { rollPool } from './dice/roll';
import { registerDice } from './dice/sheet';
import { registerActorDocument } from './documents/actor';
import { registerWoundEffects } from './effects/wound/wound-effect';
import { registerWodDots } from './elements/wod-dots';
import { registerWodHealth } from './elements/wod-health';
import { registerWodWillpower } from './elements/wod-willpower';
import { registerItemArtwork } from './item-artwork';
import { BackgroundItemSheet } from './sheets/background-sheet';
import { MeritFlawItemSheet } from './sheets/merit-flaw-sheet';
import { MortalActorSheet } from './sheets/mortal-sheet';
import { PowerItemSheet } from './sheets/power-sheet';
import { SecondaryAbilityItemSheet } from './sheets/secondary-ability-sheet';
import { SpecializationItemSheet } from './sheets/specialization-sheet';
import { registerActorPartials } from './sheets/wod-sheet';
import { registerSpecializationLinks } from './specialization-links';

Hooks.once('init', () => {
  CONFIG.WOD = WOD;
  registerActorDocument();
  CONFIG.Actor.dataModels['mortal'] = MortalDataModel;
  CONFIG.Item.dataModels['background'] = BackgroundDataModel;
  CONFIG.Item.dataModels['flaw'] = MeritFlawDataModel;
  CONFIG.Item.dataModels['merit'] = MeritFlawDataModel;
  CONFIG.Item.dataModels['power'] = PowerDataModel;
  CONFIG.Item.dataModels['secondaryAbility'] = SecondaryAbilityDataModel;
  CONFIG.Item.dataModels['specialization'] = SpecializationDataModel;
  registerItemArtwork();
  registerWodDots();
  registerWodHealth();
  registerWodWillpower();
  registerActorPartials();
  registerDice();
  registerSpecializationLinks();
  registerWoundEffects();
  game.wodRevised = { rollPool };

  const { Actors, Items } = foundry.documents.collections;

  Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet('wod-revised', MortalActorSheet, {
    label: 'WOD.Sheet.Mortal',
    makeDefault: true,
    types: ['mortal'],
  });
  Items.registerSheet('wod-revised', BackgroundItemSheet, {
    label: 'WOD.Sheet.Background',
    makeDefault: true,
    types: ['background'],
  });
  Items.registerSheet('wod-revised', MeritFlawItemSheet, {
    label: 'WOD.Sheet.MeritFlaw',
    makeDefault: true,
    types: ['flaw', 'merit'],
  });
  Items.registerSheet('wod-revised', PowerItemSheet, {
    label: 'WOD.Sheet.Power',
    makeDefault: true,
    types: ['power'],
  });
  Items.registerSheet('wod-revised', SecondaryAbilityItemSheet, {
    label: 'WOD.Sheet.SecondaryAbility',
    makeDefault: true,
    types: ['secondaryAbility'],
  });
  Items.registerSheet('wod-revised', SpecializationItemSheet, {
    label: 'WOD.Sheet.Specialization',
    makeDefault: true,
    types: ['specialization'],
  });

  console.log('wod-revised | init');
});

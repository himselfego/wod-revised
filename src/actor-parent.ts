import type { AbilitySetId } from './config';

import isObject from 'lodash/isObject';

export interface ActorParent {
  documentName: string;
  items: FoundryActor['items'];
  system?: {
    abilitySet?: AbilitySetId;
  };
  deleteEmbeddedDocuments: (embeddedName: string, ids: string[]) => Promise<unknown>;
}

export const isActorParent = (value: unknown): value is ActorParent => {
  if (!isObject(value)) {
    return false;
  }

  return 'documentName' in value && 'items' in value && value.documentName === 'Actor';
};

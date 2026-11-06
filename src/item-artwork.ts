import compact from 'lodash/compact';
import get from 'lodash/get';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import noop from 'lodash/noop';
import uniq from 'lodash/uniq';
import values from 'lodash/values';

import { isActorParent } from './actor-parent';
import {
  itemImg,
  MERIT_FLAW_IMG,
  SECONDARY_ABILITY_IMG,
  SPECIALIZATION_IMG,
  specializationArtworkCategory,
} from './config';
import { isRecord } from './guards';

interface ArtworkItem {
  img: string;
  parent?: FoundryItem['parent'];
  system: {
    category?: string;
    targetId?: string;
    targetKind?: string;
  };
  type: string;
  updateSource: (data: Record<string, unknown>) => void;
}

const managedItemImgs = (): readonly string[] => compact(uniq([
  foundry.documents.BaseItem.DEFAULT_ICON,
  CONFIG.Item.documentClass.DEFAULT_ICON,
  ...values(MERIT_FLAW_IMG),
  ...values(SECONDARY_ABILITY_IMG),
  ...values(SPECIALIZATION_IMG),
]));

const isManagedItemImg = (img: string): boolean => isEmpty(img) || includes(managedItemImgs(), img);

const stringOr = (value: unknown, fallback: string): string => {
  if (isString(value)) {
    return value;
  }

  return fallback;
};

const artworkCategory = (type: string, item: ArtworkItem, changes?: Record<string, unknown>): string | undefined => {
  if (type !== 'specialization') {
    const category = get(changes, 'system.category', item.system.category);

    return isString(category) ? category : item.system.category;
  }

  return specializationArtworkCategory(
    stringOr(get(changes, 'system.targetKind'), item.system.targetKind ?? ''),
    stringOr(get(changes, 'system.targetId'), item.system.targetId ?? ''),
    isActorParent(item.parent) ? item.parent : undefined,
  );
};

const nextItemImg = (type: string, category: unknown, currentImg: string): string | undefined => {
  const img = itemImg(type, isString(category) ? category : undefined);

  if (img === currentImg || isNil(img) || !isManagedItemImg(currentImg)) {
    return undefined;
  }

  return img;
};

const artworkFor = (type: string | undefined, category?: string): { img: string } | undefined => {
  const img = itemImg(type, category);

  if (isNil(img)) {
    return undefined;
  }

  return { img };
};

const applyCreateArtwork = (item: ArtworkItem): void => {
  const img = nextItemImg(item.type, artworkCategory(item.type, item), item.img);

  if (isNil(img)) {
    return;
  }

  item.updateSource({ img });
};

const applyUpdateArtwork = (item: ArtworkItem, changes?: Record<string, unknown>): void => {
  if (isNil(changes)) {
    return;
  }

  const type = stringOr(changes['type'], item.type);
  const img = nextItemImg(
    type,
    artworkCategory(type, item, changes),
    stringOr(changes['img'], item.img),
  );

  if (isNil(img)) {
    return;
  }

  changes['img'] = img;
};

const patchDefaultArtwork = (target: FoundryItemArtworkClass): void => {
  const original = target.getDefaultArtwork.bind(target);

  target.getDefaultArtwork = (data = {}) => {
    const artwork = artworkFor(
      data.type,
      artworkCategory(data.type ?? '', {
        img: '',
        system: data.system ?? {},
        type: data.type ?? '',
        updateSource: noop,
      }),
    );

    if (isNil(artwork)) {
      return original(data);
    }

    return artwork;
  };
};

const submitDataWithArtwork = (
  document: ArtworkItem,
  submitData: Record<string, unknown>,
): Record<string, unknown> => {
  const type = stringOr(submitData['type'], document.type);
  const img = nextItemImg(
    type,
    artworkCategory(type, document, submitData),
    stringOr(submitData['img'], document.img),
  );

  if (isNil(img)) {
    return submitData;
  }

  return { ...submitData, img };
};

const registerItemArtwork = (): void => {
  const artworkClasses = compact(uniq([foundry.documents.BaseItem, CONFIG.Item.documentClass]));

  for (const target of artworkClasses) {
    patchDefaultArtwork(target);
  }

  Hooks.on('preCreateItem', (item) => {
    applyCreateArtwork(item);
  });
  Hooks.on('preUpdateItem', (item, ...rest) => {
    const [changes] = rest;

    if (isRecord(changes)) {
      applyUpdateArtwork(item, changes);
    }
  });
};

export {
  isManagedItemImg,
  registerItemArtwork,
  submitDataWithArtwork,
};

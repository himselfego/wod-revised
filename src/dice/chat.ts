import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';

import { DEFAULT_ACTOR_IMG } from '../config';

const PORTRAIT_CLASS = 'wod-chat-portrait';

const isImg = (value: unknown): value is string => isString(value) && !isEmpty(value);

const actorFromMessage = (message: ChatMessage): FoundryActor | null => {
  const { speaker, speakerActor } = message;

  return speakerActor ?? ChatMessage.getSpeakerActor(speaker);
};

const actorPortrait = (message: ChatMessage): string | undefined => {
  const { img } = actorFromMessage(message) ?? {};

  if (img !== DEFAULT_ACTOR_IMG && isImg(img)) {
    return img;
  }

  return undefined;
};

const portraitSource = (message: ChatMessage): string | undefined => {
  const fromActor = actorPortrait(message);
  const { avatar } = message.author ?? {};

  return fromActor ?? (isImg(avatar) ? avatar : undefined);
};

const portraitAlt = (message: ChatMessage): string => {
  const actor = actorFromMessage(message);

  return actor?.name ?? message.author?.name ?? message.speaker?.alias ?? '';
};

const existingPortrait = (header: HTMLElement): HTMLImageElement | undefined => {
  const node = header.querySelector(`.${PORTRAIT_CLASS}, .avatar img, img.avatar`);

  return node instanceof HTMLImageElement ? node : undefined;
};

const attachPortrait = (message: ChatMessage, html: HTMLElement): void => {
  const header = html.querySelector('.message-header');
  const source = portraitSource(message);

  if (isNil(source) || !(header instanceof HTMLElement)) {
    return;
  }

  const current = existingPortrait(header);

  if (!isNil(current)) {
    current.alt = portraitAlt(message);
    current.classList.add(PORTRAIT_CLASS);
    current.src = source;

    return;
  }

  const portrait = document.createElement('img');

  portrait.alt = portraitAlt(message);
  portrait.className = PORTRAIT_CLASS;
  portrait.src = source;
  header.prepend(portrait);
};

export const registerChatPortrait = (): void => {
  Hooks.on('renderChatMessageHTML', (message, html) => {
    if (html instanceof HTMLElement) {
      attachPortrait(message, html);
    }
  });
};

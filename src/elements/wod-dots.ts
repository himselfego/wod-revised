import clamp from 'lodash/clamp';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import times from 'lodash/times';

import { TRAIT_MAX } from '../config';
import { WodTrackElement } from './wod-track';

/* eslint-disable unicorn/consistent-class-member-order --
 * custom element callbacks stay together; member order is perfectionist/sort-classes
 */
export class WodDotsElement extends WodTrackElement {
  public static get observedAttributes(): string[] {
    return ['max', 'value'];
  }

  protected override onPointer(index: number, button: 'left' | 'right'): void {
    void this.#commit(index, button);
  }

  protected override paint(): void {
    const cap = this.#cap();
    const filled = clamp(this.readNumber('value'), 0, cap);
    const shown = Math.max(TRAIT_MAX, cap);

    this.replaceChildren();

    times(shown, (index) => {
      const box = document.createElement('button');

      box.type = 'button';
      box.dataset['index'] = String(index);

      if (index >= cap) {
        box.classList.add('is-ghost');
        box.disabled = true;
      } else if (index < filled) {
        box.classList.add('is-filled');
      } else {
        box.classList.add('is-empty');
      }

      this.append(box);
    });
  }

  #cap(): number {
    if (this.hasAttribute('max')) {
      return Math.max(0, this.readNumber('max'));
    }

    return TRAIT_MAX;
  }

  async #commit(index: number, button: 'left' | 'right'): Promise<void> {
    const cap = this.#cap();
    const name = this.getAttribute('name');

    if (isNil(name) || isEmpty(name) || index >= cap) {
      return;
    }

    const current = clamp(this.readNumber('value'), 0, cap);
    const clicked = index + 1;
    const next = clamp(button === 'right' || current === clicked ? index : clicked, 0, cap);

    if (next === current) {
      return;
    }

    this.write('value', String(next));
    await this.updateDocument({
      [name]: next,
    });
  }
}
/* eslint-enable unicorn/consistent-class-member-order */

export const registerWodDots = (): void => {
  if (customElements.get('wod-dots')) {
    return;
  }

  customElements.define('wod-dots', WodDotsElement);
};

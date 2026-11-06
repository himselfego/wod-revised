import clamp from 'lodash/clamp';
import times from 'lodash/times';

import { WILLPOWER_ICON, WILLPOWER_MAX } from '../config';
import { WodTrackElement } from './wod-track';

/* eslint-disable unicorn/consistent-class-member-order --
 * custom element callbacks stay together; member order is perfectionist/sort-classes
 */
export class WodWillpowerElement extends WodTrackElement {
  public static get observedAttributes(): string[] {
    return ['permanent', 'temporary'];
  }

  protected override onPointer(index: number, button: 'left' | 'right'): void {
    void this.#commit(index, button);
  }

  protected override paint(): void {
    const permanent = this.#permanent();
    const temporary = this.#temporary();

    this.replaceChildren();

    const caption = document.createElement('span');
    const icon = document.createElement('i');
    const name = game.i18n.localize('WOD.Field.willpower');

    icon.className = WILLPOWER_ICON;
    icon.ariaHidden = 'true';
    caption.className = 'wod-willpower__caption';
    caption.title = name;
    caption.ariaLabel = `${name} ${temporary}/${permanent}`;
    caption.append(icon, `${temporary}/${permanent}`);
    this.append(caption);

    const track = document.createElement('div');

    track.className = 'wod-willpower__track';

    times(permanent, (index) => {
      const box = document.createElement('button');

      box.type = 'button';
      box.dataset['index'] = String(index);
      box.className = 'wod-willpower-box';
      box.classList.add(index < temporary ? 'is-filled' : 'is-empty');
      box.title = game.i18n.localize('WOD.Field.willpowerTemporary');
      track.append(box);
    });

    this.append(track);
  }

  async #commit(index: number, button: 'left' | 'right'): Promise<void> {
    const permanent = this.#permanent();

    if (index >= permanent) {
      return;
    }

    const temporary = this.#temporary();
    const clicked = index + 1;

    const nextTemporary = button === 'right' || temporary === clicked
      ? index
      : Math.min(clicked, permanent);

    this.write('temporary', String(nextTemporary));
    await this.updateDocument({
      system: {
        willpower: {
          temporary: nextTemporary,
        },
      },
    });
  }

  #permanent(): number {
    return clamp(this.readNumber('permanent'), 0, WILLPOWER_MAX);
  }

  #temporary(): number {
    return clamp(this.readNumber('temporary'), 0, this.#permanent());
  }
}
/* eslint-enable unicorn/consistent-class-member-order */

export const registerWodWillpower = (): void => {
  if (customElements.get('wod-willpower')) {
    return;
  }

  customElements.define('wod-willpower', WodWillpowerElement);
};

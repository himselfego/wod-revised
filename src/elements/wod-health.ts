import type { DamageState } from '../config';

import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import join from 'lodash/join';
import map from 'lodash/map';
import split from 'lodash/split';

import { DAMAGE_CYCLE, packWoundBoxes } from '../config';
import { WodTrackElement } from './wod-track';

const isDamageState = (value: string): value is DamageState => includes(DAMAGE_CYCLE as readonly string[], value);

const nextDamage = (current: DamageState): DamageState => {
  const index = DAMAGE_CYCLE.indexOf(current);
  const next = DAMAGE_CYCLE[(index + 1) % DAMAGE_CYCLE.length];

  return next ?? '';
};

const previousDamage = (current: DamageState): DamageState => {
  const index = DAMAGE_CYCLE.indexOf(current);
  const previous = DAMAGE_CYCLE[(index + DAMAGE_CYCLE.length - 1) % DAMAGE_CYCLE.length];

  return previous ?? '';
};

const writeDamage = (box: HTMLElement, damage: DamageState): void => {
  if (isEmpty(damage)) {
    delete box.dataset['damage'];

    return;
  }

  box.dataset['damage'] = damage;
};

/* eslint-disable unicorn/consistent-class-member-order --
 * custom element callbacks stay together; member order is perfectionist/sort-classes
 */
export class WodHealthElement extends WodTrackElement {
  public static get observedAttributes(): string[] {
    return ['states'];
  }

  protected override onPointer(index: number, button: 'left' | 'right'): void {
    void this.#commit(index, button);
  }

  protected override paint(): void {
    const states = this.#readWoundStates();

    forEach(this.querySelectorAll<HTMLElement>('.wod-health-box'), (box, index) => {
      writeDamage(box, states[index] ?? '');
    });
  }

  async #commit(index: number, button: 'left' | 'right'): Promise<void> {
    const boxes = this.#readWoundStates();
    const current = boxes[index] ?? '';

    boxes[index] = button === 'left' ? nextDamage(current) : previousDamage(current);

    const packed = packWoundBoxes(boxes);

    this.write('states', join(packed, '|'));
    await this.updateDocument({
      system: {
        health: {
          boxes: packed,
        },
      },
    });
  }

  #readWoundStates(): DamageState[] {
    const parts = split(this.getAttribute('states') ?? '', '|');

    return packWoundBoxes(map(parts, value => (isDamageState(value) ? value : '')));
  }
}
/* eslint-enable unicorn/consistent-class-member-order */

export const registerWodHealth = (): void => {
  if (customElements.get('wod-health')) {
    return;
  }

  customElements.define('wod-health', WodHealthElement);
};

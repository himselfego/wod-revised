import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';

export const SHEET_PATCH_OPTION = 'wodPatchSheet';

export const writeElementAttribute = (element: Element, name: string, value: string): void => {
  if (element.getAttribute(name) === value) {
    return;
  }

  element.setAttribute(name, value);
};

/* eslint-disable unicorn/consistent-class-member-order --
 * custom element callbacks stay together; member order is perfectionist/sort-classes
 */
export abstract class WodTrackElement extends HTMLElement {
  #listeners: AbortController | undefined = undefined;

  public attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) {
      return;
    }

    this.paint();
  }

  public connectedCallback(): void {
    const listeners = new AbortController();
    const { signal } = listeners;

    this.#listeners = listeners;
    this.addEventListener('click', (event) => {
      this.#handlePointer(event, 'left');
    }, { signal });
    this.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.#handlePointer(event, 'right');
    }, { signal });
    this.paint();
  }

  public disconnectedCallback(): void {
    this.#listeners?.abort();
    this.#listeners = undefined;
  }

  protected boxIndex(event: Event): number | undefined {
    const { target } = event;

    if (!(target instanceof HTMLElement)) {
      return undefined;
    }

    const hit = target.closest('[data-index]');

    if (!(hit instanceof HTMLElement) || !this.contains(hit)) {
      return undefined;
    }

    const raw = hit.dataset['index'];

    if (isNil(raw)) {
      return undefined;
    }

    const index = Number(raw);

    if (Number.isNaN(index)) {
      return undefined;
    }

    return index;
  }

  protected abstract onPointer(index: number, button: 'left' | 'right'): void;

  protected abstract paint(): void;

  protected readNumber(name: string): number {
    const value = Number(this.getAttribute(name));

    if (Number.isNaN(value)) {
      return 0;
    }

    return value;
  }

  protected async updateDocument(data: Record<string, unknown>): Promise<void> {
    const uuid = this.getAttribute('document-uuid');

    if (isNil(uuid) || isEmpty(uuid)) {
      return;
    }

    const document = foundry.utils.fromUuidSync(uuid);

    if (isNil(document)) {
      return;
    }

    await document.update(data, { [SHEET_PATCH_OPTION]: true });
  }

  protected write(name: string, value: string): void {
    writeElementAttribute(this, name, value);
  }

  #handlePointer(event: MouseEvent, button: 'left' | 'right'): void {
    const index = this.boxIndex(event);

    if (isNil(index)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.onPointer(index, button);
  }
}
/* eslint-enable unicorn/consistent-class-member-order */

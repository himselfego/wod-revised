export {};

declare class FoundryApplicationSheet {
  public static DEFAULT_OPTIONS: object;
  public static PARTS: object;
  public static TABS: object;
  public element: HTMLElement;
  public isEditable: boolean;
  public rendered: boolean;
  public tabGroups: Record<string, string>;
  public _createContextMenu(handler: () => object[], selector: string, options?: object): unknown;
  public _onFirstRender(context: unknown, options: unknown): Promise<void>;
  public _onRender(context: unknown, options: unknown): Promise<void>;
  public _preRender(context: unknown, options: unknown): Promise<void>;
  public _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  public close(options?: object): Promise<this>;
  public render(options?: unknown, extra?: unknown): Promise<unknown>;
  public setPosition(position?: object): unknown;
}

declare class FoundryApplicationV2 {
  public static DEFAULT_OPTIONS: object;
  public static PARTS: object;
  public element: HTMLElement;
  public rendered: boolean;
  public constructor(options?: object);
  public close(options?: object): Promise<this>;
  public render(options?: unknown, extra?: unknown): Promise<this>;
  public _onRender(context: unknown, options: unknown): Promise<void>;
  public _prepareContext(options: unknown): Promise<Record<string, unknown>>;
}

declare class FoundryActorSheetBase extends FoundryApplicationSheet {
  public document: FoundryActor;
}

declare class FoundryItemSheetBase extends FoundryApplicationSheet {
  public document: FoundryItem;
  public _processSubmitData(
    event: Event,
    form: HTMLFormElement,
    submitData: Record<string, unknown>,
    options?: object,
  ): Promise<unknown>;
}

declare class FoundryTypeDataModel {
  public static defineSchema(): Record<string, unknown>;
  public prepareBaseData(): void;
}

declare global {
  class FoundryActor {
    public documentName: 'Actor';
    public id: string;
    public img: string;
    public isOwner: boolean;
    public effects: {
      contents: FoundryActiveEffect[];
    };
    public items: {
      contents: FoundryItem[];
      get: (id: string) => FoundryItem | undefined;
    };
    public name: string;
    public system: import('./data/splat/mortal').MortalSystem;
    public uuid: string;
    public clone(
      data?: Record<string, unknown>,
      context?: Record<string, unknown>,
    ): FoundryActor | Promise<FoundryActor>;
    public getFlag(scope: string, key: string): unknown;
    public setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    public createEmbeddedDocuments(
      embeddedName: string,
      data: object[],
      options?: object,
    ): Promise<FoundryItem[]>;
    public deleteEmbeddedDocuments(embeddedName: string, ids: string[], options?: object): Promise<unknown>;
    public updateEmbeddedDocuments(embeddedName: string, updates: object[], options?: object): Promise<unknown>;
    public toObject(): Record<string, unknown>;
    public update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
    public _preUpdate(
      changed: Record<string, unknown>,
      options: Record<string, unknown>,
      user: unknown,
    ): Promise<boolean>;
  }

  class FoundryItem {
    public id: string;
    public img: string;
    public isOwner: boolean;
    public name: string;
    public parent?: FoundryActor | { documentName?: string };
    public sheet: {
      render: (options?: unknown) => Promise<unknown>;
    };
    public system: {
      category: string;
      cost?: number;
      description: string;
      family?: string;
      levels?: ReadonlyArray<{ description: string; name: string; rank: number }>;
      max?: number;
      mechanics?: string;
      modifiers?: ReadonlyArray<import('./data/feature/roll-modifier').RollModifier>;
      steps?: ReadonlyArray<{ description: string; rank: number }>;
      targetId?: string;
      targetKind?: string;
      value?: number;
    };
    public type: string;
    public uuid: string;
    public deleteDialog(): Promise<unknown>;
    public update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
    public updateSource(data: Record<string, unknown>): void;
  }

  type FoundryItemArtworkClass = {
    DEFAULT_ICON: string;
    getDefaultArtwork: (data?: {
      system?: { category?: string; targetId?: string; targetKind?: string };
      type?: string;
    }) => { img: string };
  };

  const CONFIG: {
    Actor: {
      dataModels: Record<string, unknown>;
      documentClass: {
        create: (data: Record<string, unknown>, context?: Record<string, unknown>) => Promise<FoundryActor>;
        new (...args: never[]): FoundryActor;
        prototype: FoundryActor;
      };
    };
    Item: {
      dataModels: Record<string, unknown>;
      documentClass: FoundryItemArtworkClass;
    };
    sounds: {
      dice: string;
    };
    WOD?: unknown;
    statusEffects: Array<{
      hud?: false;
      id: string;
      img: string;
      name: string;
    }>;
  };

  class FoundryActiveEffect {
    public changes: readonly unknown[];
    public description: string;
    public disabled: boolean;
    public flags: unknown;
    public id: string;
    public img: string;
    public name: string;
    public parent: unknown;
    public showIcon: number;
    public statuses: ReadonlySet<string> | readonly string[];
    public _displayScrollingStatus(enabled: boolean): void;
    public getFlag(scope: string, key: string): unknown;
  }

  class FoundryTokenDocument {
    public actor: FoundryActor | null;
    public actorLink: boolean;
  }

  class FoundryScene {
    public tokens: {
      contents: FoundryTokenDocument[];
    };
  }

  const foundry: {
    abstract: {
      TypeDataModel: typeof FoundryTypeDataModel;
    };
    applications: {
      api: {
        ApplicationV2: typeof FoundryApplicationV2;
        HandlebarsApplicationMixin: {
          (base: typeof FoundryActorSheetBase): typeof FoundryActorSheetBase;
          (base: typeof FoundryApplicationV2): typeof FoundryApplicationV2;
          (base: typeof FoundryItemSheetBase): typeof FoundryItemSheetBase;
        };
      };
      apps: {
        ImagePopout: new (options: {
          shareable?: boolean;
          src: string;
          uuid?: string;
          window?: { title?: string };
        }) => {
          render: (options?: boolean | { force?: boolean }) => unknown;
        };
      };
      handlebars: {
        loadTemplates: (paths: Record<string, string> | string[]) => Promise<unknown>;
        renderTemplate: (path: string, data?: object) => Promise<string>;
      };
      sheets: {
        ActorSheetV2: typeof FoundryActorSheetBase;
        ItemSheetV2: typeof FoundryItemSheetBase;
      };
      ux: {
        TextEditor: {
          implementation: {
            enrichHTML: (content: string, options?: object) => Promise<string>;
          };
        };
      };
    };
    appv1: {
      sheets: {
        ActorSheet: unknown;
        ItemSheet: unknown;
      };
    };
    data: {
      fields: {
        ArrayField: new (field: object, options?: object) => object;
        BooleanField: new (options?: object) => object;
        HTMLField: new (options?: object) => object;
        NumberField: new (options?: object) => object;
        SchemaField: new (fields: object, options?: object) => object;
        StringField: new (options?: object) => object;
      };
    };
    documents: {
      BaseItem: FoundryItemArtworkClass;
      collections: {
        Actors: {
          registerSheet: (...args: unknown[]) => void;
          unregisterSheet: (...args: unknown[]) => void;
        };
        Items: {
          registerSheet: (...args: unknown[]) => void;
          unregisterSheet: (...args: unknown[]) => void;
        };
      };
    };
    utils: {
      fromUuid: (uuid: string) => Promise<FoundryActor | FoundryItem | null>;
      fromUuidSync: (uuid: string) => FoundryActor | FoundryItem | null;
      mergeObject: <T extends object>(original: T, other?: object, options?: object) => T;
      randomID: (length?: number) => string;
    };
  };

  const game: {
    actors: {
      contents: FoundryActor[];
    };
    i18n: {
      format: (key: string, data?: Record<string, unknown>) => string;
      localize: (key: string) => string;
    };
    scenes: {
      contents: FoundryScene[];
    };
    user: {
      id: string;
      isGM: boolean;
    };
    wodRevised?: {
      rollPool: (input: {
        actor: FoundryActor;
        bonus?: number;
        difficulty?: number;
        isUnskilledKnowledgeAllowed?: boolean;
        keys: Iterable<string>;
        modifiers?: readonly import('./dice/modifiers').ActiveModifier[];
        specializationId?: string;
        willSpendWillpower?: boolean;
      }) => Promise<void>;
    };
  };

  class ChatMessage {
    public author?: {
      avatar?: string;
      name?: string;
    };
    public speaker?: {
      actor?: string;
      alias?: string;
    };
    public speakerActor?: FoundryActor | null;
    public static create(data: Record<string, unknown>): Promise<unknown>;
    public static getSpeaker(options?: { actor?: FoundryActor }): ChatMessage['speaker'];
    public static getSpeakerActor(speaker?: ChatMessage['speaker']): FoundryActor | null;
  }

  class Roll {
    public options?: {
      rollOrder?: number;
    };
    public terms: Array<{ results?: Array<{ active?: boolean; result: number }> }>;
    public constructor(formula: string);
    public evaluate(): Promise<this>;
  }

  const Hooks: {
    on: {
      (event: 'renderChatMessageHTML', callback: (message: ChatMessage, html: HTMLElement) => void): void;
      (
        event: 'createActor' | 'updateActor',
        callback: (
          actor: FoundryActor,
          data: Record<string, unknown>,
          options: Record<string, unknown>,
          userId: string,
        ) => void,
      ): void;
      (
        event: 'createToken',
        callback: (
          token: FoundryTokenDocument,
          data: Record<string, unknown>,
          options: Record<string, unknown>,
          userId: string,
        ) => void,
      ): void;
      (
        event: 'preCreateActiveEffect' | 'preDeleteActiveEffect' | 'preUpdateActiveEffect',
        callback: (
          effect: FoundryActiveEffect,
          data: Record<string, unknown>,
          options: Record<string, unknown>,
          userId: string,
        ) => boolean | undefined,
      ): void;
      (event: 'ready', callback: () => void): void;
      (
        event: 'renderTokenHUD' | 'renderTokenHUDHTML',
        callback: (hud: unknown, html: unknown) => void,
      ): void;
      (event: string, callback: (document: FoundryItem, ...rest: unknown[]) => void): void;
    };
    once: (event: string, callback: () => void) => void;
  };
}

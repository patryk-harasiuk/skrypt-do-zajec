import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ReaderState, ReaderStore } from '@skrypt/core';

const EMPTY_STATE: ReaderState = { chapterId: null, sectionId: null, cause: 'init' };

/**
 * Adapter między store z `core` (czysty TS) a cyklem życia Lit.
 * Każda zmiana stanu odświeża komponent i wywołuje `onChange`.
 */
export class ReaderStoreController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly onChange: (state: ReaderState) => void;
  private current: ReaderStore | null = null;
  private unsubscribe: (() => void) | undefined;

  constructor(host: ReactiveControllerHost, onChange: (state: ReaderState) => void) {
    this.host = host;
    this.onChange = onChange;
    host.addController(this);
  }

  get store(): ReaderStore | null {
    return this.current;
  }

  get state(): ReaderState {
    return this.current?.getState() ?? EMPTY_STATE;
  }

  attach(store: ReaderStore | null): void {
    this.unsubscribe?.();
    this.current = store;
    this.subscribe();
  }

  hostConnected(): void {
    this.subscribe();
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private subscribe(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.current?.subscribe((state) => {
      this.onChange(state);
      this.host.requestUpdate();
    });
  }
}

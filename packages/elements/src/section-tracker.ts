import { pickActiveIndex } from './reading-line.ts';

export interface TrackedSection {
  id: string;
  element: Element;
}

export interface TrackerHost {
  sections(): readonly TrackedSection[];
  /** Współrzędna Y linii czytania. */
  readingLine(): number;
  atEnd(): boolean;
  onActive(sectionId: string): void;
}

/**
 * Śledzi, w której sekcji jest czytelnik, na podstawie przewijania strony.
 *
 * Przewinięcia wywołane przez samą bibliotekę (strzałka, spis treści) są pomijane:
 * po nich aktywna zostaje sekcja, do której zmierzaliśmy, nawet jeśli krótka sekcja
 * leży poniżej linii czytania. Śledzenie wraca, gdy czytelnik przewinie stronę sam.
 */
export class SectionTracker {
  private readonly host: TrackerHost;
  private token = 0;
  private busy = false;
  private frame = 0;

  private readonly onScroll = (): void => {
    if (this.busy || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.evaluate();
    });
  };

  constructor(host: TrackerHost) {
    this.host = host;
  }

  connect(): void {
    // Faza przechwytywania łapie przewijanie także w przewijalnych elementach nadrzędnych.
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  disconnect(): void {
    window.removeEventListener('scroll', this.onScroll, { capture: true });
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Wykonuje przewinięcie programowe; w tym czasie obserwacja jest wstrzymana. */
  async runProgrammatic(task: () => Promise<void>): Promise<void> {
    const id = ++this.token;
    this.busy = true;
    try {
      await task();
    } finally {
      if (id === this.token) this.busy = false;
    }
  }

  evaluate(): void {
    const sections = this.host.sections();
    const tops = sections.map((section) => section.element.getBoundingClientRect().top);
    const index = pickActiveIndex(tops, this.host.readingLine(), this.host.atEnd());
    const active = sections[index];
    if (active) this.host.onActive(active.id);
  }
}

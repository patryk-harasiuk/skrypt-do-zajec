import type { ScriptDocument } from './model.ts';

/**
 * Nawigacja po dokumencie: kolejność sekcji i prosty store pozycji czytelnika.
 * Czysty TypeScript, bez zależności od UI. Adapter dla Lit jest w pakiecie `elements`.
 */

export interface SectionRef {
  chapterId: string;
  sectionId: string;
  /** Pozycja w płaskiej kolejności wszystkich sekcji dokumentu (od 0). */
  index: number;
}

/** Wszystkie sekcje dokumentu w kolejności czytania. */
export function listSections(doc: ScriptDocument): SectionRef[] {
  const result: SectionRef[] = [];
  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      result.push({ chapterId: chapter.id, sectionId: section.id, index: result.length });
    }
  }
  return result;
}

export function findSection(doc: ScriptDocument, sectionId: string): SectionRef | undefined {
  return listSections(doc).find((ref) => ref.sectionId === sectionId);
}

/**
 * Pozycja spisu treści, którą należy wyróżnić dla danej sekcji: ostatnia sekcja z tytułem
 * w tym rozdziale, nie późniejsza niż bieżąca. Gdy takiej nie ma, wyróżniamy sam rozdział
 * (`sectionId: null`).
 */
export function activeTocEntry(
  doc: ScriptDocument,
  sectionId: string | null,
): { chapterId: string; sectionId: string | null } | null {
  for (const chapter of doc.chapters) {
    const position = chapter.sections.findIndex((section) => section.id === sectionId);
    if (position === -1) continue;

    for (let i = position; i >= 0; i--) {
      const candidate = chapter.sections[i];
      if (candidate && candidate.title !== null) {
        return { chapterId: chapter.id, sectionId: candidate.id };
      }
    }
    return { chapterId: chapter.id, sectionId: null };
  }
  return null;
}

export interface ReaderState {
  /** Null tylko dla dokumentu bez rozdziałów. */
  chapterId: string | null;
  sectionId: string | null;
}

export type ReaderListener = (state: ReaderState) => void;

export interface ReaderStore {
  getState(): ReaderState;
  /** Zwraca funkcję kończącą subskrypcję. */
  subscribe(listener: ReaderListener): () => void;
  /** Przejście do sekcji. Zwraca false, gdy sekcja nie istnieje. */
  navigateTo(sectionId: string): boolean;
  next(): boolean;
  previous(): boolean;
  nextChapter(): boolean;
  previousChapter(): boolean;
}

export function createReaderStore(doc: ScriptDocument, initialSectionId?: string): ReaderStore {
  const sections = listSections(doc);
  const listeners = new Set<ReaderListener>();

  const initial = sections.find((ref) => ref.sectionId === initialSectionId) ?? sections[0];
  let state: ReaderState = {
    chapterId: initial?.chapterId ?? null,
    sectionId: initial?.sectionId ?? null,
  };

  const currentIndex = (): number => sections.findIndex((ref) => ref.sectionId === state.sectionId);

  const goTo = (ref: SectionRef | undefined): boolean => {
    if (!ref) return false;
    // Powtórne przejście do tej samej sekcji też jest zdarzeniem (np. ponowne kliknięcie
    // w spis treści ma przewinąć widok), więc zawsze powiadamiamy subskrybentów.
    state = { chapterId: ref.chapterId, sectionId: ref.sectionId };
    for (const listener of [...listeners]) listener(state);
    return true;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigateTo: (sectionId) => goTo(sections.find((ref) => ref.sectionId === sectionId)),
    next: () => goTo(sections[currentIndex() + 1]),
    previous: () => goTo(sections[currentIndex() - 1]),
    nextChapter() {
      const current = sections[currentIndex()];
      return goTo(
        sections.find(
          (ref) => current && ref.index > current.index && ref.chapterId !== current.chapterId,
        ),
      );
    },
    previousChapter() {
      const current = sections[currentIndex()];
      if (!current) return false;
      const previousChapterId = [...sections]
        .reverse()
        .find((ref) => ref.chapterId !== current.chapterId && ref.index < current.index)?.chapterId;
      return goTo(sections.find((ref) => ref.chapterId === previousChapterId));
    },
  };
}

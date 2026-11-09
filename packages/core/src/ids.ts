import { slug } from 'github-slugger';
import type { Chapter, ContentBlock, Diagnostic, Section } from './model.ts';
import type { DraftBlock, GroupResult } from './group.ts';

/**
 * Krok 5: deterministyczne identyfikatory. Ten sam plik daje te same id u każdego klienta,
 * a edycja tekstu nie przesuwa id niezwiązanych z edytowanym miejscem.
 *
 * Kolejność: jawne `{#id}` → slug tytułu → numer w rozdziale (sekcje bez tytułu).
 * Unikalność dotyczy rodzaju elementu. Rozdział i sekcja mogą mieć to samo id,
 * więc UI powinno używać prefiksów w atrybutach `id` elementów DOM.
 */

class IdAllocator {
  private readonly used = new Set<string>();

  /** Zwraca wolne id. Przy kolizji dopisuje -2, -3... i zgłasza ostrzeżenie. */
  allocate(base: string, report?: (taken: string, given: string) => void): string {
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let n = 2;
    while (this.used.has(`${base}-${n}`)) n++;
    const given = `${base}-${n}`;
    this.used.add(given);
    report?.(base, given);
    return given;
  }
}

export interface IdsResult {
  chapters: Chapter[];
  diagnostics: Diagnostic[];
}

export function assignIds(draft: GroupResult): IdsResult {
  const diagnostics: Diagnostic[] = [];
  // Osobne pule: rozdział „Pętle” i jego sekcja „Pętle” nie mogą się wykluczać.
  // Id są unikalne w obrębie swojego rodzaju (rozdział, sekcja, blok).
  const chapterIds = new IdAllocator();
  const sectionIds = new IdAllocator();
  const blockIds = new IdAllocator();

  const duplicate =
    (line: number) =>
    (taken: string, given: string): void => {
      diagnostics.push({
        code: 'duplicate-id',
        severity: 'warning',
        message:
          `Identyfikator „${taken}” jest już użyty, nadano „${given}”. ` +
          'Aby ustalić własny, dopisz na końcu nagłówka {#identyfikator}.',
        line,
      });
    };

  const chapters = draft.chapters.map((chapter, chapterIndex): Chapter => {
    const chapterId = chapterIds.allocate(
      chapter.explicitId ?? (slug(chapter.title) || `rozdzial-${chapterIndex + 1}`),
      duplicate(chapter.line),
    );

    const sections = chapter.sections.map((section, sectionIndex): Section => {
      const base = section.explicitId ?? (section.title === null ? '' : slug(section.title));
      const sectionId = sectionIds.allocate(
        base || `${chapterId}-s${sectionIndex + 1}`,
        duplicate(section.line),
      );
      return {
        id: sectionId,
        title: section.title,
        blocks: section.blocks.map((block, blockIndex) =>
          toBlock(block, sectionId, blockIndex, blockIds, section.line, duplicate),
        ),
      };
    });

    return { id: chapterId, title: chapter.title, implicit: chapter.implicit, sections };
  });

  return { chapters, diagnostics };
}

function toBlock(
  draft: DraftBlock,
  sectionId: string,
  index: number,
  ids: IdAllocator,
  line: number,
  duplicate: (line: number) => (taken: string, given: string) => void,
): ContentBlock {
  const auto = `${sectionId}-b${index + 1}`;
  if (draft.kind === 'markdown') {
    return { type: 'markdown', id: ids.allocate(auto), source: draft.source };
  }
  // Jawne id bloku (np. quizu) jest raportowane przy kolizji, automatyczne nie.
  const id = draft.explicitId
    ? ids.allocate(draft.explicitId, duplicate(line))
    : ids.allocate(auto);
  return { ...draft.block, id } as ContentBlock;
}

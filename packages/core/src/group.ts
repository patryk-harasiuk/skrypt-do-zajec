import type { Token, Tokens } from 'marked';
import type { BlockParser, WithoutId } from './blocks.ts';
import type { ContentBlock, Diagnostic } from './model.ts';
import { countLines, headingTitle, isSetextHeading, parseInfoString } from './text.ts';

/**
 * Krok 3: grupowanie płaskiej listy tokenów w rozdziały, sekcje i bloki.
 * Wynik to szkic (bez identyfikatorów). Id nadaje osobny krok `ids`.
 */

export type DraftBlock =
  | { kind: 'markdown'; source: string }
  | { kind: 'special'; block: WithoutId<ContentBlock>; explicitId: string | null };

export interface DraftSection {
  title: string | null;
  explicitId: string | null;
  /** Co utworzyło sekcję: nagłówek rozdziału, `###` albo separator. */
  origin: 'chapter' | 'h3' | 'separator';
  line: number;
  blocks: DraftBlock[];
}

export interface DraftChapter {
  title: string;
  explicitId: string | null;
  implicit: boolean;
  line: number;
  sections: DraftSection[];
}

export interface GroupOptions {
  /** Przesunięcie numeracji linii (front matter). */
  lineOffset: number;
  parsers: ReadonlyMap<string, BlockParser>;
  implicitChapterTitle: string;
}

export interface GroupResult {
  /** Tytuł z pierwszego `# H1` (null, jeśli go nie ma). */
  title: string | null;
  chapters: DraftChapter[];
  linkDefinitions: string;
  diagnostics: Diagnostic[];
}

interface State {
  title: string | null;
  titleConsumed: boolean;
  chapter: DraftChapter | null;
  section: DraftSection | null;
  /** Surowy markdown zwykłych tokenów, które jeszcze nie trafiły do bloku. */
  pending: string | null;
  line: number;
}

export function group(tokens: readonly Token[], options: GroupOptions): GroupResult {
  const diagnostics: Diagnostic[] = [];
  const chapters: DraftChapter[] = [];
  const linkDefinitions: string[] = [];
  const state: State = {
    title: null,
    titleConsumed: false,
    chapter: null,
    section: null,
    pending: null,
    line: options.lineOffset + 1,
  };

  const warn = (code: Diagnostic['code'], message: string): void => {
    diagnostics.push({ code, severity: 'warning', message, line: state.line });
  };

  /** Zamyka zbierane zwykłe tokeny w jeden blok markdown bieżącej sekcji. */
  const flush = (): void => {
    if (state.pending !== null && state.section) {
      // Obcinamy tylko puste linie z przodu: wcięcie pierwszej linii (kod) ma znaczenie.
      const source = state.pending.replace(/^(?:[ \t]*\n)+/, '').trimEnd();
      if (source) state.section.blocks.push({ kind: 'markdown', source });
    }
    state.pending = null;
  };

  const startSection = (
    title: string | null,
    explicitId: string | null,
    origin: DraftSection['origin'],
  ): DraftSection => {
    flush();
    const section: DraftSection = { title, explicitId, origin, line: state.line, blocks: [] };
    state.chapter?.sections.push(section);
    state.section = section;
    return section;
  };

  const startChapter = (title: string, explicitId: string | null, implicit: boolean): void => {
    flush();
    const chapter: DraftChapter = {
      title,
      explicitId,
      implicit,
      line: state.line,
      sections: [],
    };
    chapters.push(chapter);
    state.chapter = chapter;
    startSection(null, null, 'chapter');
  };

  /** Treść lub `###` przed pierwszym `##` trafia do niejawnego rozdziału. */
  const ensureChapter = (): void => {
    if (!state.chapter) startChapter(options.implicitChapterTitle, null, true);
  };

  const addContent = (raw: string): void => {
    ensureChapter();
    state.pending = (state.pending ?? '') + raw;
  };

  const handleHeading = (token: Tokens.Heading): void => {
    const { title, id } = headingTitle(token);

    if (token.depth <= 3 && isSetextHeading(token)) {
      warn(
        'setext-heading',
        `Nagłówek „${title}” jest zapisany przez podkreślenie (=== lub ---). Użyj #, ## lub ###, ` +
          'bo podkreślenie --- bywa mylone z separatorem sekcji.',
      );
    }

    switch (token.depth) {
      case 1:
        if (!state.titleConsumed) {
          state.titleConsumed = true;
          state.title = title;
        } else {
          warn('extra-h1', `Dodatkowy nagłówek # „${title}”. Tytuł skryptu może być tylko jeden.`);
          addContent(token.raw);
        }
        return;
      case 2:
        startChapter(title, id, false);
        return;
      case 3:
        ensureChapter();
        startSection(title, id, 'h3');
        return;
      default:
        addContent(token.raw);
    }
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        if (state.pending !== null) state.pending += token.raw;
        break;
      case 'def':
        linkDefinitions.push(token.raw.trim());
        break;
      case 'heading':
        handleHeading(token as Tokens.Heading);
        break;
      case 'hr':
        if (/^[\s-]+$/.test(token.raw)) {
          warn(
            'dash-separator',
            'Separator --- zamieniono na nową sekcję. Do dzielenia na sekcje używaj ***.',
          );
        }
        ensureChapter();
        startSection(null, null, 'separator');
        break;
      case 'code': {
        const code = token as Tokens.Code;
        const { lang, attrs } = parseInfoString(code.lang);
        const parser = options.parsers.get(lang);
        if (!parser) {
          addContent(token.raw);
          break;
        }
        ensureChapter();
        flush();
        state.section?.blocks.push({
          kind: 'special',
          block: parser.parse({ code: code.text, attrs }),
          explicitId: attrs['id'] ?? null,
        });
        break;
      }
      default:
        addContent(token.raw);
    }
    state.line += countLines(token.raw);
  }
  flush();

  return {
    title: state.title,
    chapters: dropEmpty(chapters, diagnostics),
    linkDefinitions: linkDefinitions.join('\n'),
    diagnostics,
  };
}

/** Usuwa puste sekcje bez tytułu i puste niejawne rozdziały. Pilnuje, by rozdział miał sekcję. */
function dropEmpty(chapters: DraftChapter[], diagnostics: Diagnostic[]): DraftChapter[] {
  const result: DraftChapter[] = [];
  for (const chapter of chapters) {
    const kept: DraftSection[] = [];
    for (const section of chapter.sections) {
      const empty = section.title === null && section.blocks.length === 0;
      if (!empty) {
        kept.push(section);
      } else if (section.origin === 'separator') {
        diagnostics.push({
          code: 'empty-section',
          severity: 'warning',
          message: 'Pusta sekcja: dwa separatory *** pod rząd albo separator na końcu rozdziału.',
          line: section.line,
        });
      }
    }

    if (kept.length === 0) {
      if (chapter.implicit) continue;
      diagnostics.push({
        code: 'empty-chapter',
        severity: 'warning',
        message: `Rozdział „${chapter.title}” nie ma żadnej treści.`,
        line: chapter.line,
      });
      kept.push({
        title: null,
        explicitId: null,
        origin: 'chapter',
        line: chapter.line,
        blocks: [],
      });
    }
    result.push({ ...chapter, sections: kept });
  }
  return result;
}

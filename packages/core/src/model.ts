/**
 * Model domenowy skryptu (ISD, Intermediate Script Document).
 * Niezależny od marked.js i od warstwy UI. W całości serializowalny do JSON.
 */

export interface ScriptDocument {
  /** Z front matter (`id`), w przeciwnym razie slug tytułu. */
  id: string;
  /** Z front matter (`title`), w przeciwnym razie pierwszy `# H1`. Pusty, jeśli brak. */
  title: string;
  /** Wersja podana przez autora we front matter (`version`). */
  version: string | null;
  /** Hash treści. Różny hash = różna wersja skryptu (ważne w sesji z prowadzącym). */
  contentHash: string;
  /** Surowe dane z front matter. */
  metadata: Readonly<Record<string, unknown>>;
  /**
   * Definicje linków referencyjnych (`[id]: url`) z całego dokumentu.
   * Blok markdown jest renderowany osobno, więc render dopisuje je do źródła bloku.
   */
  linkDefinitions: string;
  chapters: Chapter[];
  toc: TocEntry[];
}

export interface Chapter {
  id: string;
  title: string;
  /** Rozdział utworzony niejawnie (treść przed pierwszym `##`). */
  implicit: boolean;
  /** Zawsze co najmniej jedna sekcja. */
  sections: Section[];
}

export interface Section {
  /** Stabilny identyfikator, podstawa synchronizacji z prowadzącym i zapisu postępu. */
  id: string;
  /** Brak tytułu dla sekcji tworzonych przez `***`. */
  title: string | null;
  blocks: ContentBlock[];
}

/** Ciąg zwykłych elementów markdown (akapity, listy, tabele, kod, wzory...). */
export interface MarkdownBlock {
  type: 'markdown';
  id: string;
  source: string;
}

export interface MermaidBlock {
  type: 'mermaid';
  id: string;
  code: string;
}

export type ContentBlock = MarkdownBlock | MermaidBlock;

export interface TocEntry {
  /** Id sekcji, do której prowadzi pozycja (dla rozdziału: jego pierwsza sekcja). */
  sectionId: string;
  chapterId: string;
  title: string;
  /** 1 = rozdział, 2 = sekcja z tytułem. */
  level: 1 | 2;
  /** Numeracja ("2", "2.1"). Null dla rozdziału niejawnego i jego sekcji. */
  number: string | null;
  children: TocEntry[];
}

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  | 'invalid-front-matter'
  | 'missing-title'
  | 'extra-h1'
  | 'setext-heading'
  | 'dash-separator'
  | 'empty-section'
  | 'empty-chapter'
  | 'duplicate-id';

/** Uwaga dla autora skryptu. Parser nigdy nie rzuca wyjątku z powodu treści. */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** Komunikat po polsku, przeznaczony dla autora. */
  message: string;
  /** Numer linii w pliku źródłowym (od 1). */
  line: number;
}

export interface ParseResult {
  document: ScriptDocument;
  diagnostics: Diagnostic[];
}

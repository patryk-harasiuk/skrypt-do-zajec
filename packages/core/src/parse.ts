import { slug } from 'github-slugger';
import { createBlockRegistry, defaultBlockParsers, type BlockParser } from './blocks.ts';
import { group } from './group.ts';
import { hashString } from './hash.ts';
import { assignIds } from './ids.ts';
import { lex } from './lex.ts';
import type { Diagnostic, ParseResult } from './model.ts';
import { preprocess } from './preprocess.ts';
import { buildToc } from './toc.ts';

export interface ParseOptions {
  /** Dodatkowe parsery bloków specjalnych (obok wbudowanego `mermaid`). */
  blockParsers?: readonly BlockParser[];
  /** Tytuł rozdziału tworzonego dla treści przed pierwszym `##`. */
  implicitChapterTitle?: string;
}

function metaString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * Publiczne wejście: tekst .md → ScriptDocument + uwagi dla autora.
 * Nie rzuca wyjątków z powodu treści, błędy zwraca jako diagnostykę.
 *
 * Kroki: preprocess → lex → group → ids → toc.
 */
export function parseScript(markdown: string, options: ParseOptions = {}): ParseResult {
  const pre = preprocess(markdown);
  const tokens = lex(pre.markdown);
  const registry = createBlockRegistry([...defaultBlockParsers, ...(options.blockParsers ?? [])]);

  const draft = group(tokens, {
    lineOffset: pre.lineOffset,
    parsers: registry,
    implicitChapterTitle: options.implicitChapterTitle ?? 'Wstęp',
  });
  const { chapters, diagnostics: idDiagnostics } = assignIds(draft);

  const title = metaString(pre.metadata['title']) ?? draft.title ?? '';
  const diagnostics: Diagnostic[] = [...pre.diagnostics, ...draft.diagnostics, ...idDiagnostics];
  if (!title) {
    diagnostics.push({
      code: 'missing-title',
      severity: 'warning',
      message: 'Brak tytułu skryptu. Dodaj nagłówek # na początku albo pole title w metadanych.',
      line: 1,
    });
  }
  diagnostics.sort((a, b) => a.line - b.line);

  return {
    document: {
      id: metaString(pre.metadata['id']) ?? (slug(title) || 'skrypt'),
      title,
      version: metaString(pre.metadata['version']),
      contentHash: hashString(pre.normalized),
      metadata: pre.metadata,
      linkDefinitions: draft.linkDefinitions,
      chapters,
      toc: buildToc(chapters),
    },
    diagnostics,
  };
}

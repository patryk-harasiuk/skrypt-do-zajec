import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from './model.ts';

export interface Preprocessed {
  /** Markdown bez front matter, ze znormalizowanymi końcami linii. */
  markdown: string;
  metadata: Record<string, unknown>;
  /** Liczba linii zajętych przez front matter (przesunięcie numeracji linii). */
  lineOffset: number;
  /** Cały znormalizowany tekst (z front matter), podstawa hasha wersji. */
  normalized: string;
  diagnostics: Diagnostic[];
}

const FRONT_MATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Krok 1: normalizacja tekstu i wycięcie front matter (marked go nie obsługuje). */
export function preprocess(input: string): Preprocessed {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const diagnostics: Diagnostic[] = [];
  const match = FRONT_MATTER.exec(normalized);

  if (!match) {
    return { markdown: normalized, metadata: {}, lineOffset: 0, normalized, diagnostics };
  }

  const strip = (metadata: Record<string, unknown>): Preprocessed => ({
    markdown: normalized.slice(match[0].length),
    metadata,
    lineOffset: match[0].split('\n').length - 1,
    normalized,
    diagnostics,
  });

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1] ?? '');
  } catch (error) {
    diagnostics.push({
      code: 'invalid-front-matter',
      severity: 'error',
      message: `Nie udało się odczytać metadanych na początku pliku (YAML): ${
        error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'nieznany błąd'
      }`,
      line: 1,
    });
    return strip({});
  }

  if (parsed === null || parsed === undefined) return strip({});
  if (isPlainObject(parsed)) return strip(parsed);

  // Tekst między dwoma `---`, który nie jest słownikiem YAML, to zwykła treść z separatorami.
  return { markdown: normalized, metadata: {}, lineOffset: 0, normalized, diagnostics };
}

import type { Token, Tokens } from 'marked';

/** Tekst bez formatowania z tokenów inline (np. tytuł nagłówka). */
export function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens)) {
        return plainText(token.tokens as Token[]);
      }
      if ('text' in token && typeof token.text === 'string') return token.text;
      return token.raw;
    })
    .join('');
}

const EXPLICIT_ID = /\s*\{#([\p{L}\p{N}_-]+)\}\s*$/u;

/** Wydziela `{#id}` z końca tytułu nagłówka. */
export function splitExplicitId(title: string): { title: string; id: string | null } {
  const match = EXPLICIT_ID.exec(title);
  if (!match) return { title: title.trim(), id: null };
  return { title: title.slice(0, match.index).trim(), id: match[1] ?? null };
}

export function headingTitle(heading: Tokens.Heading): { title: string; id: string | null } {
  return splitExplicitId(plainText(heading.tokens));
}

/** Nagłówek setext (podkreślony `===` lub `---`) nie zaczyna się od `#`. */
export function isSetextHeading(heading: Tokens.Heading): boolean {
  return !heading.raw.trimStart().startsWith('#');
}

export interface InfoString {
  lang: string;
  attrs: Record<string, string>;
}

/**
 * Rozbija info string bloku kodu: ```` ```quiz id=petle-1 ```` → lang "quiz", attrs { id }.
 * Obsługuje wartości w cudzysłowach. Słowa bez `=` są ignorowane.
 */
export function parseInfoString(info: string | undefined): InfoString {
  const trimmed = (info ?? '').trim();
  const langEnd = trimmed.search(/\s/);
  const lang = (langEnd === -1 ? trimmed : trimmed.slice(0, langEnd)).toLowerCase();
  const rest = langEnd === -1 ? '' : trimmed.slice(langEnd);

  const attrs: Record<string, string> = {};
  for (const match of rest.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) {
    attrs[match[1] as string] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return { lang, attrs };
}

/** Liczba przejść do nowej linii, czyli przesunięcie numeru linii po tym tekście. */
export function countLines(text: string): number {
  let count = 0;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) count++;
  return count;
}

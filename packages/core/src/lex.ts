import { Lexer, type Token } from 'marked';

/**
 * Krok 2: Markdown → płaska lista tokenów najwyższego poziomu.
 * Używamy `new Lexer()`, a nie globalnego `marked.lexer()`, żeby rozszerzenia
 * zarejestrowane przez aplikację hosta nie zmieniały wyniku parsowania.
 */
export function lex(markdown: string): Token[] {
  return new Lexer({ gfm: true }).lex(markdown);
}

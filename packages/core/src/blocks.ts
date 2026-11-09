import type { ContentBlock, MermaidBlock } from './model.ts';

/**
 * Rejestr parserów bloków specjalnych. Blok kodu o danym `lang` przestaje być zwykłym
 * kodem w markdown i staje się osobnym blokiem modelu (np. diagram, później quiz).
 */

export interface BlockParserInput {
  code: string;
  attrs: Readonly<Record<string, string>>;
}

/** Blok bez id. Id nadaje krok `ids`. */
export type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

export interface BlockParser {
  lang: string;
  parse(input: BlockParserInput): WithoutId<ContentBlock>;
}

export const mermaidParser: BlockParser = {
  lang: 'mermaid',
  parse: ({ code }): WithoutId<MermaidBlock> => ({ type: 'mermaid', code }),
};

export const defaultBlockParsers: readonly BlockParser[] = [mermaidParser];

export function createBlockRegistry(parsers: readonly BlockParser[]): Map<string, BlockParser> {
  const registry = new Map<string, BlockParser>();
  for (const parser of parsers) registry.set(parser.lang.toLowerCase(), parser);
  return registry;
}

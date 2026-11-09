import { html, nothing, type TemplateResult } from 'lit';
import type { ContentBlock, MarkdownBlock, MermaidBlock } from '@skrypt/core';
import { strings } from './strings.pl.ts';

/**
 * Rejestr widoków bloków: typ bloku z modelu → funkcja zwracająca szablon.
 * Nowe typy bloków (quiz, fiszki...) rejestrują się tu bez zmian w czytniku.
 */

export interface BlockContext {
  linkDefinitions: string;
}

export type BlockTemplate = TemplateResult | typeof nothing;
export type BlockRenderer<T extends ContentBlock = ContentBlock> = (
  block: T,
  context: BlockContext,
) => BlockTemplate;

const renderers = new Map<string, BlockRenderer>();

export function registerBlockView<T extends ContentBlock>(
  type: T['type'],
  renderer: BlockRenderer<T>,
): void {
  renderers.set(type, renderer as unknown as BlockRenderer);
}

export function renderBlock(block: ContentBlock, context: BlockContext): BlockTemplate {
  const renderer = renderers.get(block.type);
  if (!renderer) {
    console.warn(`[skrypt] Brak widoku dla bloku typu „${block.type}”.`);
    return nothing;
  }
  return renderer(block, context);
}

registerBlockView<MarkdownBlock>(
  'markdown',
  (block, { linkDefinitions }) =>
    html`<skrypt-block-markdown
      .source=${block.source}
      .linkDefinitions=${linkDefinitions}
    ></skrypt-block-markdown>`,
);

// Tymczasowo: źródło diagramu jako kod. Prawdziwy render Mermaid to krok 4.
registerBlockView<MermaidBlock>(
  'mermaid',
  (block) =>
    html`<figure class="diagram-source">
      <figcaption>${strings.diagram}</figcaption>
      <pre><code>${block.code}</code></pre>
    </figure>`,
);

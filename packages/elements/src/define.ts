import { SkryptBlockMarkdown } from './skrypt-block-markdown.ts';
import { SkryptChapter } from './skrypt-chapter.ts';
import { SkryptReader } from './skrypt-reader.ts';
import { SkryptSection } from './skrypt-section.ts';
import { SkryptSectionBar } from './skrypt-section-bar.ts';
import { SkryptToc } from './skrypt-toc.ts';

const elements = {
  'skrypt-block-markdown': SkryptBlockMarkdown,
  'skrypt-chapter': SkryptChapter,
  'skrypt-reader': SkryptReader,
  'skrypt-section': SkryptSection,
  'skrypt-section-bar': SkryptSectionBar,
  'skrypt-toc': SkryptToc,
} as const;

/** Rejestruje komponenty. Bezpieczne przy wielokrotnym wywołaniu. */
export function defineElements(): void {
  for (const [tag, constructor] of Object.entries(elements)) {
    if (!customElements.get(tag)) customElements.define(tag, constructor);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'skrypt-block-markdown': SkryptBlockMarkdown;
    'skrypt-chapter': SkryptChapter;
    'skrypt-reader': SkryptReader;
    'skrypt-section': SkryptSection;
    'skrypt-section-bar': SkryptSectionBar;
    'skrypt-toc': SkryptToc;
  }
}

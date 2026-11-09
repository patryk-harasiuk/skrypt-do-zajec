import createDOMPurify, { type DOMPurify } from 'dompurify';
import { Marked } from 'marked';

/**
 * Renderowanie bloku markdown do bezpiecznego HTML.
 * Każdy HTML pokazywany w UI przechodzi przez `renderMarkdown`, czyli przez DOMPurify.
 */

const parser = new Marked({ gfm: true });

let purify: DOMPurify | undefined;

/** Własna instancja DOMPurify, żeby nie dzielić hooków z aplikacją hosta. */
function getPurify(): DOMPurify {
  if (purify) return purify;
  const instance = createDOMPurify(window);
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') ?? '')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  purify = instance;
  return instance;
}

/**
 * @param source Markdown jednego bloku.
 * @param linkDefinitions Definicje linków referencyjnych z całego dokumentu
 *   (`ScriptDocument.linkDefinitions`), bo blok jest parsowany osobno.
 */
export function renderMarkdown(source: string, linkDefinitions = ''): string {
  const input = linkDefinitions ? `${source}\n\n${linkDefinitions}\n` : source;
  const html = parser.parse(input, { async: false });
  return getPurify().sanitize(html);
}

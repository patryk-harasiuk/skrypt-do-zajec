import { LitElement, css, html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from './render.ts';
import { contentStyles, focusRing, themeVariables } from './styles.ts';

/** Zdarzenie wysyłane po kliknięciu linku wewnętrznego (`#id`) w treści. */
export interface AnchorEventDetail {
  hash: string;
}

/** Blok zwykłego markdown. Jedyne miejsce w UI, które wstawia HTML (zawsze po sanityzacji). */
export class SkryptBlockMarkdown extends LitElement {
  static override properties = {
    source: { type: String },
    linkDefinitions: { type: String, attribute: false },
  };

  declare source: string;
  declare linkDefinitions: string;

  private renderedHtml = '';

  constructor() {
    super();
    this.source = '';
    this.linkDefinitions = '';
  }

  static override styles = [
    themeVariables,
    focusRing,
    contentStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('source') || changed.has('linkDefinitions')) {
      this.renderedHtml = renderMarkdown(this.source, this.linkDefinitions);
    }
  }

  protected override render() {
    return html`<div class="content" @click=${this.handleClick}>
      ${unsafeHTML(this.renderedHtml)}
    </div>`;
  }

  /**
   * Linki `#id` nie działają natywnie przez granicę shadow root (i zmieniałyby adres strony
   * hosta), więc przechwytujemy kliknięcie i przekazujemy je czytnikowi.
   */
  private handleClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!href?.startsWith('#') || href.length < 2) return;

    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent<AnchorEventDetail>('skrypt-anchor', {
        detail: { hash: href.slice(1) },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

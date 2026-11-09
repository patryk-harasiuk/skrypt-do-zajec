import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import {
  activeTocEntry,
  createReaderStore,
  parseScript,
  type Diagnostic,
  type ReaderState,
  type ScriptDocument,
} from '@skrypt/core';
import type { AnchorEventDetail } from './skrypt-block-markdown.ts';
import type { SkryptChapter } from './skrypt-chapter.ts';
import type { TocSelectDetail } from './skrypt-toc.ts';
import { strings } from './strings.pl.ts';
import { ReaderStoreController } from './store-controller.ts';
import { focusRing, themeVariables } from './styles.ts';

/**
 * Główny komponent biblioteki.
 *
 * Treść podaje aplikacja hosta, jedną z dwóch właściwości (nie atrybutów HTML):
 * - `markdown`: tekst .md, parsowany wewnątrz,
 * - `document`: gotowy `ScriptDocument` (ma pierwszeństwo, gdy ustawione oba).
 *
 * Zdarzenia: `skrypt-ready` (detail: { document }) i `skrypt-diagnostics` (detail: Diagnostic[]).
 */
export class SkryptReader extends LitElement {
  static override properties = {
    markdown: { attribute: false },
    document: { attribute: false },
    drawerOpen: { state: true },
  };

  declare markdown: string | null;
  declare document: ScriptDocument | null;
  declare drawerOpen: boolean;

  private loaded: ScriptDocument | null = null;
  private pendingEvents: { document: ScriptDocument; diagnostics: Diagnostic[] } | null = null;
  private pendingScroll = false;
  private renderedChapterId: string | null = null;
  private chapterNumbers = new Map<string, string | null>();
  private sectionNumbers = new Map<string, string | null>();

  private readonly controller = new ReaderStoreController(this, () => {
    this.pendingScroll = true;
  });

  constructor() {
    super();
    this.markdown = null;
    this.document = null;
    this.drawerOpen = false;
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.drawerOpen) {
        this.drawerOpen = false;
        this.shadowRoot?.querySelector<HTMLElement>('.menu')?.focus();
      }
    });
  }

  static override styles = [
    themeVariables,
    focusRing,
    css`
      :host {
        display: block;
        color: var(--_fg);
        background: var(--_bg);
        font-family: var(--_font);
      }
      .layout {
        display: grid;
        grid-template-columns: 17.5rem minmax(0, 1fr);
        align-items: start;
      }
      .sidebar {
        position: sticky;
        top: 0;
        max-height: 100vh;
        overflow-y: auto;
        padding: 1.25rem 0.75rem;
        border-right: 1px solid var(--_border);
        box-sizing: border-box;
      }
      .sidebar-title {
        margin: 0 0.6rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--_muted);
      }
      .bar,
      .backdrop {
        display: none;
      }
      main {
        min-width: 0;
        padding: 2rem clamp(1rem, 4vw, 3rem) 4rem;
      }
      .page {
        max-width: var(--_measure);
        margin-inline: auto;
      }
      .cover {
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--_border);
      }
      .doc-title {
        margin: 0 0 1.25rem;
        font-size: 2.4rem;
        line-height: 1.2;
      }
      .cover skrypt-toc {
        margin-left: -0.6rem;
      }
      .cover-toc-title {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--_muted);
      }
      .message {
        color: var(--_muted);
        padding: 2rem 1rem;
      }
      .chapter-nav {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 3rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--_border);
      }
      .chapter-nav button {
        font: inherit;
        color: var(--_accent);
        background: none;
        border: 1px solid var(--_border);
        border-radius: 8px;
        padding: 0.6rem 0.9rem;
        text-align: left;
        cursor: pointer;
        max-width: 48%;
      }
      .chapter-nav button:hover {
        background: var(--_surface);
      }
      .chapter-nav .next {
        margin-left: auto;
        text-align: right;
      }
      .chapter-nav small {
        display: block;
        color: var(--_muted);
        font-size: 0.75rem;
      }

      @media (max-width: 62rem) {
        .layout {
          display: block;
        }
        .bar {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: var(--_bg);
          border-bottom: 1px solid var(--_border);
        }
        .menu {
          white-space: nowrap;
          font: inherit;
          color: var(--_fg);
          background: var(--_surface);
          border: 1px solid var(--_border);
          border-radius: 8px;
          padding: 0.4rem 0.7rem;
          cursor: pointer;
        }
        .bar-title {
          min-width: 0;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar {
          position: fixed;
          z-index: 4;
          top: 0;
          bottom: 0;
          left: 0;
          width: min(20rem, 85vw);
          max-height: none;
          background: var(--_bg);
          transform: translateX(-100%);
          visibility: hidden;
          transition:
            transform 0.2s ease,
            visibility 0.2s;
        }
        .drawer-open .sidebar {
          transform: none;
          visibility: visible;
        }
        .drawer-open .backdrop {
          display: block;
          position: fixed;
          z-index: 3;
          inset: 0;
          background: rgb(0 0 0 / 0.4);
        }
        .doc-title {
          font-size: 1.9rem;
        }
        main {
          padding-top: 1.25rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sidebar {
          transition: none;
        }
      }
    `,
  ];

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('markdown') || changed.has('document')) this.load();
  }

  protected override updated(): void {
    if (this.pendingEvents) {
      const { document, diagnostics } = this.pendingEvents;
      this.pendingEvents = null;
      this.dispatchEvent(
        new CustomEvent('skrypt-ready', { detail: { document }, bubbles: true, composed: true }),
      );
      if (diagnostics.length > 0) {
        this.dispatchEvent(
          new CustomEvent('skrypt-diagnostics', {
            detail: diagnostics,
            bubbles: true,
            composed: true,
          }),
        );
      }
    }

    const chapterId = this.controller.state.chapterId;
    const chapterChanged = chapterId !== this.renderedChapterId;
    this.renderedChapterId = chapterId;
    if (this.pendingScroll) {
      this.pendingScroll = false;
      void this.scrollToCurrent(chapterChanged);
    }
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await this.chapterElement()?.updateComplete;
    return result;
  }

  /** Przejście do sekcji (np. z kodu aplikacji hosta). Zwraca false dla nieznanego id. */
  goToSection(sectionId: string): boolean {
    return this.controller.store?.navigateTo(sectionId) ?? false;
  }

  private load(): void {
    const previousSectionId = this.controller.state.sectionId;
    let doc: ScriptDocument | null = null;
    let diagnostics: Diagnostic[] = [];

    if (this.document) {
      doc = this.document;
    } else if (this.markdown !== null) {
      ({ document: doc, diagnostics } = parseScript(this.markdown));
    }

    this.loaded = doc;
    this.chapterNumbers = new Map();
    this.sectionNumbers = new Map();
    for (const entry of doc?.toc ?? []) {
      this.chapterNumbers.set(entry.chapterId, entry.number);
      for (const child of entry.children) this.sectionNumbers.set(child.sectionId, child.number);
    }

    // Nowy store zastępuje stary. Pozycja zostaje, jeśli sekcja istnieje w nowym dokumencie.
    this.controller.attach(doc ? createReaderStore(doc, previousSectionId ?? undefined) : null);
    this.renderedChapterId = null;
    this.pendingEvents = doc ? { document: doc, diagnostics } : null;
  }

  private chapterElement(): SkryptChapter | null {
    return this.renderRoot.querySelector<SkryptChapter>('skrypt-chapter');
  }

  private async scrollToCurrent(chapterChanged: boolean): Promise<void> {
    await this.updateComplete;
    const doc = this.loaded;
    const { chapterId, sectionId } = this.controller.state;
    const chapterEl = this.chapterElement();
    if (!doc || !chapterEl || !sectionId) return;

    const chapter = doc.chapters.find((c) => c.id === chapterId);
    const isFirstInChapter = chapter?.sections[0]?.id === sectionId;
    const isFirstChapter = doc.chapters[0]?.id === chapterId;

    // Pierwsza sekcja rozdziału: pokazujemy jego początek (w pierwszym rozdziale razem z okładką).
    const target: Element | null = isFirstInChapter
      ? isFirstChapter
        ? this.renderRoot.querySelector('main')
        : chapterEl
      : chapterEl.sectionElement(sectionId);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target?.scrollIntoView?.({
      block: 'start',
      behavior: chapterChanged || reduceMotion ? 'auto' : 'smooth',
    });
  }

  private onTocSelect(event: CustomEvent<TocSelectDetail>): void {
    this.drawerOpen = false;
    this.goToSection(event.detail.sectionId);
  }

  private onAnchor(event: CustomEvent<AnchorEventDetail>): void {
    let id = event.detail.hash;
    try {
      id = decodeURIComponent(id);
    } catch {
      // Zostawiamy id w oryginalnej postaci.
    }
    this.goToSection(id);
  }

  protected override render() {
    const doc = this.loaded;
    if (!doc) return html`<p class="message">${strings.nothingLoaded}</p>`;

    const state: ReaderState = this.controller.state;
    const active = activeTocEntry(doc, state.sectionId);
    const chapterIndex = doc.chapters.findIndex((c) => c.id === state.chapterId);
    const chapter = doc.chapters[chapterIndex];
    const title = doc.title || strings.untitledScript;

    const toc = html`<skrypt-toc
      .entries=${doc.toc}
      .activeChapterId=${active?.chapterId ?? null}
      .activeSectionId=${active?.sectionId ?? null}
      @skrypt-toc-select=${this.onTocSelect}
    ></skrypt-toc>`;

    return html`
      <div class="layout ${this.drawerOpen ? 'drawer-open' : ''}">
        <div class="bar">
          <button
            type="button"
            class="menu"
            aria-expanded=${this.drawerOpen ? 'true' : 'false'}
            aria-controls="sidebar"
            @click=${() => (this.drawerOpen = !this.drawerOpen)}
          >
            ${this.drawerOpen ? strings.closeToc : strings.openToc}
          </button>
          <span class="bar-title">${title}</span>
        </div>
        <div class="backdrop" @click=${() => (this.drawerOpen = false)}></div>
        <aside id="sidebar" class="sidebar">
          <p class="sidebar-title">${strings.toc}</p>
          ${toc}
        </aside>
        <main @skrypt-anchor=${this.onAnchor}>
          <div class="page">
            ${
              chapterIndex === 0
                ? html`<header class="cover">
                    <h1 class="doc-title">${title}</h1>
                    ${
                      doc.toc.length > 0
                        ? html`<p class="cover-toc-title">${strings.toc}</p>
                            <skrypt-toc
                              .entries=${doc.toc}
                              .activeChapterId=${null}
                              .activeSectionId=${null}
                              @skrypt-toc-select=${this.onTocSelect}
                            ></skrypt-toc>`
                        : nothing
                    }
                  </header>`
                : nothing
            }
            ${
              chapter
                ? html`<skrypt-chapter
                      .chapter=${chapter}
                      .number=${this.chapterNumbers.get(chapter.id) ?? null}
                      .sectionNumbers=${this.sectionNumbers}
                      .linkDefinitions=${doc.linkDefinitions}
                    ></skrypt-chapter>
                    ${this.renderChapterNav(doc, chapterIndex)}`
                : html`<p class="message">${strings.emptyScript}</p>`
            }
          </div>
        </main>
      </div>
    `;
  }

  private renderChapterNav(doc: ScriptDocument, index: number) {
    const previous = doc.chapters[index - 1];
    const next = doc.chapters[index + 1];
    if (!previous && !next) return nothing;
    return html`<nav class="chapter-nav" aria-label=${strings.chapterNavigation}>
      ${
        previous
          ? html`<button type="button" @click=${() => this.controller.store?.previousChapter()}>
              <small>${strings.previousChapter}</small>${previous.title}
            </button>`
          : nothing
      }
      ${
        next
          ? html`<button
              type="button"
              class="next"
              @click=${() => this.controller.store?.nextChapter()}
            >
              <small>${strings.nextChapter}</small>${next.title}
            </button>`
          : nothing
      }
    </nav>`;
  }
}

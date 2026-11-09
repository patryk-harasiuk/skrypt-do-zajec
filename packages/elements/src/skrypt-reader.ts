import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import {
  activeTocEntry,
  createReaderStore,
  parseScript,
  sectionPosition,
  type Diagnostic,
  type NavigationCause,
  type ReaderState,
  type ScriptDocument,
} from '@skrypt/core';
import { interpretKey, type KeyboardMode } from './keyboard-navigation.ts';
import { anchorY, planStep } from './plan-step.ts';
import { readingLineY } from './reading-line.ts';
import {
  findScrollParent,
  isScrolledToEnd,
  scrollByY,
  visibleRegion,
  waitForScrollSettled,
  type Region,
} from './scroll.ts';
import { SectionTracker } from './section-tracker.ts';
import type { AnchorEventDetail } from './skrypt-block-markdown.ts';
import type { SkryptChapter } from './skrypt-chapter.ts';
import type { SectionActivateDetail } from './skrypt-section.ts';
import type { SectionStepDetail } from './skrypt-section-bar.ts';
import type { TocSelectDetail } from './skrypt-toc.ts';
import { strings } from './strings.pl.ts';
import { ReaderStoreController } from './store-controller.ts';
import { focusRing, themeVariables } from './styles.ts';

/**
 * Tryb czytania:
 * - `sections` (domyślny): aktywna sekcja jest wyróżniona w tekście, pozostałe przygaszone,
 *   a u dołu jest pasek z przyciskami. Strzałki ← → przechodzą między sekcjami.
 * - `continuous`: zwykły ciągły tekst, aktywna sekcja widoczna tylko w spisie treści.
 *   Strzałki ← → działają tak samo.
 */
export type ReaderMode = 'sections' | 'continuous';

export interface NavigateEventDetail {
  chapterId: string | null;
  sectionId: string | null;
  cause: NavigationCause;
}

/**
 * Główny komponent biblioteki.
 *
 * Treść podaje aplikacja hosta, jedną z dwóch właściwości (nie atrybutów HTML):
 * - `markdown`: tekst .md, parsowany wewnątrz,
 * - `document`: gotowy `ScriptDocument` (ma pierwszeństwo, gdy ustawione oba).
 *
 * Zdarzenia (wszystkie `bubbles` i `composed`):
 * - `skrypt-ready` (detail: { document }),
 * - `skrypt-diagnostics` (detail: Diagnostic[]),
 * - `skrypt-navigate` (detail: { chapterId, sectionId, cause }),
 * - `skrypt-mode-change` (detail: { mode }), wysyłane tylko po zmianie przez użytkownika.
 */
export class SkryptReader extends LitElement {
  static override properties = {
    markdown: { attribute: false },
    document: { attribute: false },
    mode: { type: String, reflect: true },
    keyboard: { type: String },
    drawerOpen: { state: true },
    announcement: { state: true },
  };

  declare markdown: string | null;
  declare document: ScriptDocument | null;
  declare mode: ReaderMode;
  declare keyboard: KeyboardMode;
  declare drawerOpen: boolean;
  declare announcement: string;

  private loaded: ScriptDocument | null = null;
  private pendingEvents: { document: ScriptDocument; diagnostics: Diagnostic[] } | null = null;
  private pendingScroll = false;
  private renderedChapterId: string | null = null;
  private chapterNumbers = new Map<string, string | null>();
  private sectionNumbers = new Map<string, string | null>();
  private keyTarget: EventTarget | null = null;

  private readonly controller = new ReaderStoreController(this, (state) => this.onNavigated(state));

  private readonly tracker = new SectionTracker({
    sections: () =>
      (this.chapterElement()?.sectionElements() ?? []).map((element) => ({
        id: element.dataset['sectionId'] ?? '',
        element,
      })),
    readingLine: () => {
      const { top, bottom } = this.region();
      return readingLineY(top, bottom);
    },
    atEnd: () => isScrolledToEnd(this.scrollParent()),
    onActive: (sectionId) => {
      this.controller.store?.setActive(sectionId);
    },
  });

  private readonly onKeydown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Escape' && this.drawerOpen) {
      this.drawerOpen = false;
      this.shadowRoot?.querySelector<HTMLElement>('.menu')?.focus();
      return;
    }
    const target = keyEvent.composedPath()[0] as Element | undefined;
    const action = interpretKey(keyEvent, target);
    if (!action) return;

    const handled =
      action.kind === 'section' ? this.step(action.direction) : this.stepChapter(action.direction);
    // Blokujemy domyślną akcję przeglądarki tylko wtedy, gdy rzeczywiście nawigowaliśmy.
    if (handled) keyEvent.preventDefault();
  };

  constructor() {
    super();
    this.markdown = null;
    this.document = null;
    this.mode = 'sections';
    this.keyboard = 'focus';
    this.drawerOpen = false;
    this.announcement = '';
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
      .tools {
        margin: 0 0 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--_border);
      }
      .mode-toggle {
        display: block;
        width: 100%;
        font: inherit;
        font-size: 0.9rem;
        text-align: left;
        color: var(--_fg);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: 8px;
        padding: 0.5rem 0.7rem;
        cursor: pointer;
      }
      .mode-toggle[aria-pressed='true'] {
        border-color: var(--_accent);
        box-shadow: inset 3px 0 0 var(--_accent);
      }
      .hint {
        margin: 0.5rem 0.2rem 0;
        font-size: 0.78rem;
        line-height: 1.4;
        color: var(--_muted);
      }
      .bar,
      .backdrop {
        display: none;
      }
      .column {
        display: flex;
        flex-direction: column;
        align-self: stretch;
        min-width: 0;
        /* Host może ustawić np. 100vh, żeby pasek sekcji był zawsze przy dolnej krawędzi. */
        min-height: var(--skrypt-min-height, 0);
      }
      main {
        flex: 1;
      }
      main {
        padding: 2rem clamp(1rem, 4vw, 3rem) 4rem;
      }
      main:focus {
        outline: none;
      }
      .page {
        max-width: var(--_measure);
        margin-inline: auto;
      }
      .section-bar {
        position: sticky;
        bottom: 0;
        z-index: 2;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .cover {
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--_border);
      }
      .cover skrypt-toc {
        margin-left: -0.6rem;
      }
      .doc-title {
        margin: 0 0 1.25rem;
        font-size: 2.4rem;
        line-height: 1.2;
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
          z-index: 3;
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
          z-index: 5;
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
          z-index: 4;
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

  override connectedCallback(): void {
    super.connectedCallback();
    this.tracker.connect();
    this.bindKeyboard();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.tracker.disconnect();
    this.unbindKeyboard();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('markdown') || changed.has('document')) this.load();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('keyboard')) this.bindKeyboard();

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

  // --- publiczne API -------------------------------------------------------------------

  /** Przejście do sekcji (np. z kodu aplikacji hosta). Zwraca false dla nieznanego id. */
  goToSection(sectionId: string): boolean {
    return this.controller.store?.navigateTo(sectionId) ?? false;
  }

  /** To samo co klawisz →. Zwraca false, gdy nie ma dokąd przejść. */
  nextSection(): boolean {
    return this.step(1);
  }

  /** To samo co klawisz ←. */
  previousSection(): boolean {
    return this.step(-1);
  }

  /** Ustawia fokus na obszarze czytania, żeby działały skróty klawiszowe (`keyboard="focus"`). */
  focusReader(): void {
    this.renderRoot.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
  }

  // --- nawigacja -----------------------------------------------------------------------

  private onNavigated(state: ReaderState): void {
    if (state.cause === 'navigate') {
      this.pendingScroll = true;
      this.announcement = strings.announceSection(this.sectionLabel(state.sectionId));
    }
    this.dispatchEvent(
      new CustomEvent<NavigateEventDetail>('skrypt-navigate', {
        detail: { chapterId: state.chapterId, sectionId: state.sectionId, cause: state.cause },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Strzałka ← / →: przewija w obrębie długiej sekcji albo przechodzi do sąsiedniej. */
  private step(direction: 1 | -1): boolean {
    const store = this.controller.store;
    const sectionId = this.controller.state.sectionId;
    if (!store || !sectionId) return false;

    const element = this.chapterElement()?.sectionElement(sectionId);
    if (element) {
      const { top, bottom } = this.region();
      const rect = element.getBoundingClientRect();
      const plan = planStep(
        {
          visibleTop: top,
          visibleBottom: bottom,
          sectionTop: rect.top,
          sectionBottom: rect.bottom,
        },
        direction,
      );
      if (plan.kind === 'scroll-within') {
        void this.scrollDelta(plan.delta, true);
        return true;
      }
    }

    if (direction === 1) return store.next();
    if (store.previous()) return true;
    return this.scrollToPageTop();
  }

  private stepChapter(direction: 1 | -1): boolean {
    const store = this.controller.store;
    if (!store) return false;
    return direction === 1 ? store.nextChapter() : store.previousChapter();
  }

  /** Przed pierwszą sekcją wracamy na górę strony (okładka ze spisem treści). */
  private scrollToPageTop(): boolean {
    const main = this.renderRoot.querySelector('main');
    if (!main) return false;
    const delta = main.getBoundingClientRect().top - this.region().top;
    if (Math.abs(delta) < 8) return false;
    void this.scrollDelta(delta, true);
    return true;
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
    const region = this.region();

    // Pierwsza sekcja rozdziału: pokazujemy jego początek (w pierwszym rozdziale razem
    // z okładką). Pozostałe sekcje lądują na linii lądowania (15% wysokości obszaru).
    let target: Element | null;
    let landing: number;
    if (isFirstInChapter) {
      target = isFirstChapter ? this.renderRoot.querySelector('main') : chapterEl;
      landing = isFirstChapter ? region.top : region.top + 16;
    } else {
      target = chapterEl.sectionElement(sectionId);
      landing = anchorY(region.top, region.bottom);
    }
    if (!target) return;

    const delta = target.getBoundingClientRect().top - landing;
    if (Math.abs(delta) < 1) return;
    await this.scrollDelta(delta, !chapterChanged);
  }

  /** Przewija o `delta` pikseli; w tym czasie śledzenie sekcji jest wstrzymane. */
  private scrollDelta(delta: number, smooth: boolean): Promise<void> {
    const container = this.scrollParent();
    return this.tracker.runProgrammatic(async () => {
      scrollByY(container, delta, smooth);
      await waitForScrollSettled(container);
    });
  }

  // --- geometria -----------------------------------------------------------------------

  private scrollParent(): Element | null {
    return findScrollParent(this);
  }

  /** Widoczny obszar czytania: bez przyklejonych pasków (górnego na telefonie i dolnego). */
  private region(): Region {
    const region = visibleRegion(this.scrollParent());
    // Paski bierzemy pod uwagę tylko wtedy, gdy są faktycznie widoczne (mają wysokość).
    const topBar = this.renderRoot.querySelector<HTMLElement>('.bar')?.getBoundingClientRect();
    if (topBar && topBar.height > 0) region.top = Math.max(region.top, topBar.bottom);
    const bottomBar = this.renderRoot
      .querySelector<HTMLElement>('skrypt-section-bar')
      ?.getBoundingClientRect();
    if (bottomBar && bottomBar.height > 0) region.bottom = Math.min(region.bottom, bottomBar.top);
    return region;
  }

  // --- klawiatura ----------------------------------------------------------------------

  private bindKeyboard(): void {
    this.unbindKeyboard();
    if (!this.isConnected || this.keyboard === 'none') return;
    this.keyTarget = this.keyboard === 'page' ? window : this;
    this.keyTarget.addEventListener('keydown', this.onKeydown);
  }

  private unbindKeyboard(): void {
    this.keyTarget?.removeEventListener('keydown', this.onKeydown);
    this.keyTarget = null;
  }

  // --- ładowanie -----------------------------------------------------------------------

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

  /** Tytuł sekcji do komunikatów: jej własny albo tytuł rozdziału. */
  private sectionLabel(sectionId: string | null): string {
    const doc = this.loaded;
    for (const chapter of doc?.chapters ?? []) {
      const section = chapter.sections.find((s) => s.id === sectionId);
      if (!section) continue;
      const number = this.sectionNumbers.get(section.id);
      const title = section.title ?? chapter.title;
      return number ? `${number} ${title}` : title;
    }
    return '';
  }

  // --- zdarzenia z komponentów ---------------------------------------------------------

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

  private onSectionActivate(event: CustomEvent<SectionActivateDetail>): void {
    this.controller.store?.setActive(event.detail.sectionId);
  }

  private onSectionStep(event: CustomEvent<SectionStepDetail>): void {
    this.step(event.detail.direction);
  }

  private toggleMode(): void {
    this.mode = this.mode === 'sections' ? 'continuous' : 'sections';
    this.dispatchEvent(
      new CustomEvent('skrypt-mode-change', {
        detail: { mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // --- widok ---------------------------------------------------------------------------

  protected override render() {
    const doc = this.loaded;
    if (!doc) return html`<p class="message">${strings.nothingLoaded}</p>`;

    const state: ReaderState = this.controller.state;
    const active = activeTocEntry(doc, state.sectionId);
    const chapterIndex = doc.chapters.findIndex((c) => c.id === state.chapterId);
    const chapter = doc.chapters[chapterIndex];
    const title = doc.title || strings.untitledScript;
    const sectionsMode = this.mode === 'sections';

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
          <div class="tools">
            <button
              type="button"
              class="mode-toggle"
              aria-pressed=${sectionsMode ? 'true' : 'false'}
              @click=${this.toggleMode}
            >
              ${strings.modeSections}
            </button>
            ${this.keyboard === 'none' ? nothing : html`<p class="hint">${strings.keyboardHint}</p>`}
          </div>
          <p class="sidebar-title">${strings.toc}</p>
          ${toc}
        </aside>
        <div class="column">
          <main
            tabindex="-1"
            aria-label=${strings.readingArea}
            @skrypt-anchor=${this.onAnchor}
            @skrypt-section-activate=${this.onSectionActivate}
          >
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
                        .mode=${this.mode}
                        .activeSectionId=${state.sectionId}
                      ></skrypt-chapter>
                      ${this.renderChapterNav(doc, chapterIndex)}`
                  : html`<p class="message">${strings.emptyScript}</p>`
              }
            </div>
          </main>
          ${sectionsMode && chapter ? this.renderSectionBar(doc, state) : nothing}
        </div>
      </div>
      <div class="sr-only" aria-live="polite">${this.announcement}</div>
    `;
  }

  private renderSectionBar(doc: ScriptDocument, state: ReaderState) {
    const position = sectionPosition(doc, state.sectionId);
    if (!position) return nothing;
    return html`<skrypt-section-bar
      class="section-bar"
      .heading=${this.sectionLabel(state.sectionId)}
      .sectionNumber=${position.sectionNumber}
      .sectionCount=${position.sectionCount}
      .chapterNumber=${position.chapterNumber}
      .chapterCount=${position.chapterCount}
      .progress=${(position.index + 1) / position.total}
      .hasPrevious=${position.index > 0}
      .hasNext=${position.index < position.total - 1}
      @skrypt-section-step=${this.onSectionStep}
    ></skrypt-section-bar>`;
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

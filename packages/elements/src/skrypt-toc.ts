import { LitElement, css, html, nothing } from 'lit';
import type { TocEntry } from '@skrypt/core';
import { strings } from './strings.pl.ts';
import { focusRing, themeVariables } from './styles.ts';

export interface TocSelectDetail {
  sectionId: string;
}

/** Spis treści: rozdziały i sekcje z tytułem. Kliknięcie wysyła `skrypt-toc-select`. */
export class SkryptToc extends LitElement {
  static override properties = {
    entries: { attribute: false },
    /** Rozdział, w którym jest czytelnik. */
    activeChapterId: { attribute: false },
    /** Wyróżniona sekcja z tytułem. Null = wyróżniony jest sam rozdział. */
    activeSectionId: { attribute: false },
  };

  declare entries: readonly TocEntry[];
  declare activeChapterId: string | null;
  declare activeSectionId: string | null;

  constructor() {
    super();
    this.entries = [];
    this.activeChapterId = null;
    this.activeSectionId = null;
  }

  static override styles = [
    themeVariables,
    focusRing,
    css`
      :host {
        display: block;
        font-family: var(--_ui);
        color: var(--_fg);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      ol ol {
        margin: 0.1rem 0 0.4rem 0.9rem;
        border-left: 1px solid var(--_border);
      }
      button {
        display: block;
        width: 100%;
        text-align: left;
        font: inherit;
        font-size: 0.95rem;
        line-height: 1.35;
        color: inherit;
        background: none;
        border: 0;
        border-radius: 6px;
        padding: 0.4rem 0.6rem;
        cursor: pointer;
      }
      button:hover {
        background: var(--_surface);
      }
      .chapter {
        font-weight: 600;
      }
      .chapter.in-current {
        color: var(--_accent);
      }
      .active {
        background: var(--_surface);
        box-shadow: inset 3px 0 0 var(--_accent);
      }
      .number {
        color: var(--_muted);
        margin-right: 0.1em;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  private select(sectionId: string): void {
    this.dispatchEvent(
      new CustomEvent<TocSelectDetail>('skrypt-toc-select', {
        detail: { sectionId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render() {
    return html`<nav aria-label=${strings.toc}>
      <ol>
        ${this.entries.map((chapter) => {
          const inCurrent = chapter.chapterId === this.activeChapterId;
          const chapterActive = inCurrent && this.activeSectionId === null;
          return html`<li>
            <button
              type="button"
              class="chapter ${inCurrent ? 'in-current' : ''} ${chapterActive ? 'active' : ''}"
              aria-current=${chapterActive ? 'location' : nothing}
              @click=${() => this.select(chapter.sectionId)}
            >
              ${chapter.number ? html`<span class="number">${chapter.number} </span>` : nothing}${chapter.title}
            </button>
            ${
              chapter.children.length > 0
                ? html`<ol>
                    ${chapter.children.map((section) => {
                      const active = inCurrent && section.sectionId === this.activeSectionId;
                      return html`<li>
                        <button
                          type="button"
                          class=${active ? 'active' : ''}
                          aria-current=${active ? 'location' : nothing}
                          @click=${() => this.select(section.sectionId)}
                        >
                          ${section.number ? html`<span class="number">${section.number} </span>` : nothing}${section.title}
                        </button>
                      </li>`;
                    })}
                  </ol>`
                : nothing
            }
          </li>`;
        })}
      </ol>
    </nav>`;
  }
}

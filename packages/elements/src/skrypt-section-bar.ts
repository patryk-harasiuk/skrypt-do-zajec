import { LitElement, css, html, nothing } from 'lit';
import { strings } from './strings.pl.ts';
import { focusRing, themeVariables } from './styles.ts';

export interface SectionStepDetail {
  direction: 1 | -1;
}

/**
 * Pasek trybu czytania po sekcjach: tytuł, pozycja i przyciski ‹ ›.
 * Przyciski są dla dotyku, bo bez klawiatury nie ma strzałek.
 */
export class SkryptSectionBar extends LitElement {
  static override properties = {
    heading: { type: String },
    sectionNumber: { type: Number },
    sectionCount: { type: Number },
    chapterNumber: { type: Number },
    chapterCount: { type: Number },
    /** Postęp w całym skrypcie, 0..1. */
    progress: { type: Number },
    hasPrevious: { type: Boolean },
    hasNext: { type: Boolean },
  };

  declare heading: string;
  declare sectionNumber: number;
  declare sectionCount: number;
  declare chapterNumber: number;
  declare chapterCount: number;
  declare progress: number;
  declare hasPrevious: boolean;
  declare hasNext: boolean;

  constructor() {
    super();
    this.heading = '';
    this.sectionNumber = 1;
    this.sectionCount = 1;
    this.chapterNumber = 1;
    this.chapterCount = 1;
    this.progress = 0;
    this.hasPrevious = false;
    this.hasNext = false;
  }

  static override styles = [
    themeVariables,
    focusRing,
    css`
      :host {
        display: block;
        font-family: var(--_font);
        color: var(--_fg);
        background: var(--_bg);
        border-top: 1px solid var(--_border);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        max-width: calc(var(--_measure) + 8rem);
        margin-inline: auto;
      }
      .info {
        flex: 1;
        min-width: 0;
        text-align: center;
        line-height: 1.3;
      }
      .name {
        font-weight: 600;
        font-size: 0.95rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .where {
        font-size: 0.78rem;
        color: var(--_muted);
      }
      button {
        flex: none;
        width: 2.75rem;
        height: 2.75rem;
        display: grid;
        place-items: center;
        color: var(--_fg);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: 8px;
        cursor: pointer;
      }
      button:hover:not(:disabled) {
        border-color: var(--_accent);
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      /* Strzałka rysowana CSS-em, żeby nie zależeć od glifów czcionki. */
      .chevron {
        width: 0.6rem;
        height: 0.6rem;
        border-top: 2px solid currentColor;
        border-right: 2px solid currentColor;
      }
      .prev .chevron {
        transform: translateX(0.12rem) rotate(-135deg);
      }
      .next .chevron {
        transform: translateX(-0.12rem) rotate(45deg);
      }
      .track {
        height: 3px;
        background: var(--_border);
      }
      .fill {
        height: 100%;
        background: var(--_accent);
      }
      @media (prefers-reduced-motion: no-preference) {
        .fill {
          transition: width 0.2s;
        }
      }
    `,
  ];

  private step(direction: 1 | -1): void {
    this.dispatchEvent(
      new CustomEvent<SectionStepDetail>('skrypt-section-step', {
        detail: { direction },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render() {
    const percent = Math.round(Math.min(1, Math.max(0, this.progress)) * 100);
    return html`
      <div role="group" aria-label=${strings.sectionBar}>
        <div
          class="track"
          role="progressbar"
          aria-label=${strings.progress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${percent}
        >
          <div class="fill" style="width: ${percent}%"></div>
        </div>
        <div class="row">
          <button
            type="button"
            class="prev"
            aria-label=${strings.previousSection}
            ?disabled=${!this.hasPrevious}
            @click=${() => this.step(-1)}
          >
            <span class="chevron"></span>
          </button>
          <div class="info">
            <div class="name">${this.heading}</div>
            <div class="where">
              ${strings.sectionOf(this.sectionNumber, this.sectionCount)}
              ${
                this.chapterCount > 1
                  ? html` · ${strings.chapterOf(this.chapterNumber, this.chapterCount)}`
                  : nothing
              }
            </div>
          </div>
          <button
            type="button"
            class="next"
            aria-label=${strings.nextSection}
            ?disabled=${!this.hasNext}
            @click=${() => this.step(1)}
          >
            <span class="chevron"></span>
          </button>
        </div>
      </div>
    `;
  }
}

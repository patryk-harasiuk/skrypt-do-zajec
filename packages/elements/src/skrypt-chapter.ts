import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Chapter } from '@skrypt/core';
import type { SkryptSection } from './skrypt-section.ts';
import { strings } from './strings.pl.ts';
import { themeVariables } from './styles.ts';

/** Rozdział jako jedna przewijana strona z sekcjami. */
export class SkryptChapter extends LitElement {
  static override properties = {
    chapter: { attribute: false },
    number: { type: String },
    sectionNumbers: { attribute: false },
    linkDefinitions: { attribute: false },
    activeSectionId: { attribute: false },
    mode: { type: String },
  };

  declare chapter: Chapter | null;
  declare number: string | null;
  declare sectionNumbers: ReadonlyMap<string, string | null>;
  declare linkDefinitions: string;
  declare activeSectionId: string | null;
  declare mode: 'sections' | 'continuous';

  constructor() {
    super();
    this.chapter = null;
    this.number = null;
    this.sectionNumbers = new Map();
    this.linkDefinitions = '';
    this.activeSectionId = null;
    this.mode = 'continuous';
  }

  static override styles = [
    themeVariables,
    css`
      :host {
        display: block;
        scroll-margin-top: var(--skrypt-scroll-offset, 4.5rem);
      }
      /* Otwarcie rozdziału: mały napis „Rozdział N”, tytuł i krótka linia. */
      .opener {
        margin: 1rem 0 1.5rem;
        padding-bottom: 1.25rem;
        position: relative;
      }
      .opener::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 3rem;
        border-top: 3px solid var(--_accent);
      }
      .title {
        margin: 0;
        font-family: var(--_font);
        font-size: 2.1rem;
        line-height: 1.2;
        color: var(--_fg);
        text-wrap: balance;
      }
      .kicker {
        display: block;
        margin-bottom: 0.4rem;
        font-family: var(--_ui);
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--_muted);
      }
      .empty {
        font-family: var(--_ui);
        color: var(--_muted);
      }
    `,
  ];

  /** Elementy sekcji rozdziału w kolejności czytania. */
  sectionElements(): SkryptSection[] {
    return [...this.renderRoot.querySelectorAll<SkryptSection>('skrypt-section')];
  }

  /** Element sekcji o danym id, jeśli należy do tego rozdziału. */
  sectionElement(sectionId: string): SkryptSection | null {
    return this.sectionElements().find((el) => el.dataset['sectionId'] === sectionId) ?? null;
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    const sections = [...this.renderRoot.querySelectorAll<SkryptSection>('skrypt-section')];
    await Promise.all(sections.map((section) => section.updateComplete));
    return result;
  }

  protected override render() {
    const chapter = this.chapter;
    if (!chapter) return nothing;
    const hasContent = chapter.sections.some((s) => s.blocks.length > 0 || s.title !== null);
    return html`
      <header class="opener">
        <h2 class="title">
          ${
            this.number
              ? html`<span class="kicker">${strings.chapterLabel(this.number)} </span>`
              : nothing
          }${chapter.title}
        </h2>
      </header>
      ${
        hasContent
          ? repeat(
              chapter.sections,
              (section) => section.id,
              (section) =>
                html`<skrypt-section
                  .section=${section}
                  .number=${this.sectionNumbers.get(section.id) ?? null}
                  .linkDefinitions=${this.linkDefinitions}
                  .mode=${this.mode}
                  .active=${section.id === this.activeSectionId}
                ></skrypt-section>`,
            )
          : html`<p class="empty">${strings.emptyChapter}</p>`
      }
    `;
  }
}

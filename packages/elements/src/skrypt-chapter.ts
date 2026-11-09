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
      .title {
        margin: 0 0 0.5rem;
        font-family: var(--_font);
        font-size: 1.9rem;
        line-height: 1.25;
        color: var(--_fg);
      }
      .number {
        color: var(--_muted);
        margin-right: 0.1em;
        font-variant-numeric: tabular-nums;
      }
      .empty {
        font-family: var(--_font);
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
      <h2 class="title">
        ${this.number ? html`<span class="number">${this.number} </span>` : nothing}${chapter.title}
      </h2>
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

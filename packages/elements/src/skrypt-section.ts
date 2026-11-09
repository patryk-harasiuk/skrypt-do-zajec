import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Section } from '@skrypt/core';
import { renderBlock } from './block-views.ts';
import { themeVariables } from './styles.ts';

export interface SectionActivateDetail {
  sectionId: string;
}

/** Jedna sekcja skryptu: opcjonalny tytuł i bloki. */
export class SkryptSection extends LitElement {
  static override properties = {
    section: { attribute: false },
    number: { type: String },
    linkDefinitions: { attribute: false },
    /** Tryb czytania; w trybie `sections` sekcje poza aktywną są przygaszone. */
    mode: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
  };

  declare section: Section | null;
  declare number: string | null;
  declare linkDefinitions: string;
  declare mode: 'sections' | 'continuous';
  declare active: boolean;

  constructor() {
    super();
    this.section = null;
    this.number = null;
    this.linkDefinitions = '';
    this.mode = 'continuous';
    this.active = false;
    this.addEventListener('click', () => {
      if (this.mode === 'sections' && !this.active && this.section) {
        this.dispatchEvent(
          new CustomEvent<SectionActivateDetail>('skrypt-section-activate', {
            detail: { sectionId: this.section.id },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
  }

  static override styles = [
    themeVariables,
    css`
      :host {
        display: block;
        padding-block: 1.25rem;
        scroll-margin-top: var(--skrypt-scroll-offset, 4.5rem);
      }
      :host(:not(:first-of-type)) {
        border-top: 1px dashed var(--_border);
      }
      /* Tryb po sekcjach: znacznik na marginesie i przygaszenie sekcji nieaktywnych.
         Przygaszamy kolorem (muted ma kontrast > 4.5:1), a nie przezroczystością. */
      :host([mode='sections']) {
        padding-left: 1rem;
        border-left: 3px solid transparent;
      }
      :host([mode='sections'][active]) {
        border-left-color: var(--_accent);
      }
      :host([mode='sections']:not([active])) {
        --_section-fg: var(--_muted);
        cursor: pointer;
      }
      @media (prefers-reduced-motion: no-preference) {
        :host([mode='sections']) {
          transition: border-color 0.15s;
        }
      }
      .title {
        margin: 0 0 0.75rem;
        font-family: var(--_font);
        font-size: 1.3rem;
        line-height: 1.3;
        color: var(--_section-fg, var(--_fg));
      }
      .number {
        color: var(--_muted);
        margin-right: 0.1em;
        font-variant-numeric: tabular-nums;
      }
      .blocks > * + * {
        margin-top: 1rem;
      }
      .diagram-source {
        margin: 0;
        font-family: var(--_font);
      }
      .diagram-source figcaption {
        font-size: 0.8rem;
        color: var(--_muted);
        margin-bottom: 0.25rem;
      }
      .diagram-source pre {
        margin: 0;
        padding: 0.9em 1.1em;
        background: var(--_code-bg);
        border-radius: 8px;
        overflow-x: auto;
        font-family: var(--_mono);
        font-size: 0.875rem;
      }
    `,
  ];

  protected override willUpdate(): void {
    if (this.section) this.dataset['sectionId'] = this.section.id;
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    const children = [...this.renderRoot.querySelectorAll<LitElement>('skrypt-block-markdown')];
    await Promise.all(children.map((child) => child.updateComplete));
    return result;
  }

  protected override render() {
    const section = this.section;
    if (!section) return nothing;
    return html`
      ${
        section.title === null
          ? nothing
          : html`<h3 class="title">
              ${this.number ? html`<span class="number">${this.number} </span>` : nothing}${section.title}
            </h3>`
      }
      <div class="blocks">
        ${repeat(
          section.blocks,
          (block) => block.id,
          (block) => renderBlock(block, { linkDefinitions: this.linkDefinitions }),
        )}
      </div>
    `;
  }
}

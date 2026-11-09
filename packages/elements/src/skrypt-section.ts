import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Section } from '@skrypt/core';
import { renderBlock } from './block-views.ts';
import { themeVariables } from './styles.ts';

/** Jedna sekcja skryptu: opcjonalny tytuł i bloki. */
export class SkryptSection extends LitElement {
  static override properties = {
    section: { attribute: false },
    number: { type: String },
    linkDefinitions: { attribute: false },
  };

  declare section: Section | null;
  declare number: string | null;
  declare linkDefinitions: string;

  constructor() {
    super();
    this.section = null;
    this.number = null;
    this.linkDefinitions = '';
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
      .title {
        margin: 0 0 0.75rem;
        font-family: var(--_font);
        font-size: 1.3rem;
        line-height: 1.3;
        color: var(--_fg);
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

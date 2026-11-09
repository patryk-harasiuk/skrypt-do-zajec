import { css } from 'lit';

/**
 * Zmienne motywu. Aplikacja hosta może je nadpisać na elemencie <skrypt-reader>
 * (np. `skrypt-reader { --skrypt-accent: #c0392b; }`).
 *
 * Wewnątrz biblioteki używamy zmiennych `--_*`, które mają wartości domyślne.
 */
export const themeVariables = css`
  :host {
    --_fg: var(--skrypt-fg, #1f2430);
    --_bg: var(--skrypt-bg, #ffffff);
    --_muted: var(--skrypt-muted, #5b6472);
    --_accent: var(--skrypt-accent, #1d5fd1);
    --_border: var(--skrypt-border, #dde1e8);
    --_surface: var(--skrypt-surface, #f5f7fa);
    --_code-bg: var(--skrypt-code-bg, #f1f3f7);
    --_font: var(
      --skrypt-font-family,
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif
    );
    --_mono: var(--skrypt-mono-family, ui-monospace, 'SF Mono', Menlo, Consolas, monospace);
    --_font-size: var(--skrypt-font-size, 1.0625rem);
    --_measure: var(--skrypt-measure, 70ch);
  }
`;

export const focusRing = css`
  :focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
`;

/** Typografia treści z markdown. Używana wewnątrz bloku markdown. */
export const contentStyles = css`
  .content {
    font-family: var(--_font);
    font-size: var(--_font-size);
    line-height: 1.7;
    color: var(--_section-fg, var(--_fg));
    overflow-wrap: break-word;
  }
  .content > :first-child {
    margin-top: 0;
  }
  .content > :last-child {
    margin-bottom: 0;
  }
  p,
  ul,
  ol,
  blockquote,
  pre,
  table {
    margin: 0 0 1em;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.3;
    margin: 1.6em 0 0.5em;
  }
  h4 {
    font-size: 1.1em;
  }
  h5,
  h6 {
    font-size: 1em;
  }
  ul,
  ol {
    padding-left: 1.5em;
  }
  li + li {
    margin-top: 0.25em;
  }
  a {
    color: var(--_accent);
    text-underline-offset: 0.15em;
  }
  code {
    font-family: var(--_mono);
    font-size: 0.9em;
    background: var(--_code-bg);
    padding: 0.12em 0.35em;
    border-radius: 4px;
  }
  pre {
    background: var(--_code-bg);
    padding: 0.9em 1.1em;
    border-radius: 8px;
    overflow-x: auto;
    line-height: 1.5;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 0.875em;
  }
  blockquote {
    margin-left: 0;
    padding: 0.1em 1em;
    border-left: 4px solid var(--_border);
    color: var(--_muted);
  }
  table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
  }
  th,
  td {
    border: 1px solid var(--_border);
    padding: 0.4em 0.75em;
    text-align: left;
  }
  th {
    background: var(--_surface);
  }
  img {
    max-width: 100%;
    height: auto;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--_border);
    margin: 2em 0;
  }
  input[type='checkbox'] {
    margin-right: 0.4em;
  }
`;

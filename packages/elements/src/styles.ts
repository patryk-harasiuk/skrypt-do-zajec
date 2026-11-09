import { css } from 'lit';

/**
 * Zmienne motywu. Aplikacja hosta może je nadpisać na elemencie <skrypt-reader>
 * (np. `skrypt-reader { --skrypt-accent: #c0392b; }`). Nadpisanie przez hosta ma
 * pierwszeństwo przed wbudowanymi motywami (`theme`).
 *
 * Wewnątrz biblioteki używamy zmiennych `--_*`, które mają wartości domyślne
 * (motyw „Papier”: ciepła biel, ciemnoszary tekst, szeryfy).
 */
export const themeVariables = css`
  :host {
    --_fg: var(--skrypt-fg, #2c2c2c);
    --_bg: var(--skrypt-bg, #fbfaf6);
    --_muted: var(--skrypt-muted, #5d5a52);
    --_accent: var(--skrypt-accent, #8a3416);
    --_border: var(--skrypt-border, #e2ddd0);
    --_surface: var(--skrypt-surface, #f3f0e7);
    --_code-bg: var(--skrypt-code-bg, #f0ece1);
    /* „Biurko” za kartką: tło strony w trybie po sekcjach. */
    --_stage: var(--skrypt-stage, #f1eee5);
    /* Tło i cień aktywnej sekcji (uniesionej karty). */
    --_active-bg: var(--skrypt-active-bg, var(--_bg));
    --_shadow: var(--skrypt-shadow, rgb(60 50 30 / 0.16));
    /* Wysunięcie aktywnej sekcji poza kolumnę tekstu i jej powiększenie. */
    --_bleed: var(--skrypt-section-bleed, 0.75rem);
    --_active-scale: var(--skrypt-active-scale, 1.02);
    /* Tekst do czytania: szeryfowy stos systemowy. Własny krój podaje host. */
    --_font: var(
      --skrypt-font-family,
      Charter,
      'Bitstream Charter',
      'Sitka Text',
      Cambria,
      Georgia,
      'Times New Roman',
      serif
    );
    /* Interfejs (spis treści, przyciski, paski): krój bezszeryfowy. */
    --_ui: var(
      --skrypt-ui-font-family,
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
    --_measure: var(--skrypt-measure, 68ch);
    /* Rytm pionowy: odstępy w treści są wielokrotnością jednej linii tekstu. */
    --_leading: var(--skrypt-line-height, 1.65);
    --_rhythm: calc(var(--_font-size) * var(--_leading));
  }
`;

/** Wbudowane motywy. Ustawiają publiczne zmienne `--skrypt-*` na elemencie czytnika. */
export const themes = css`
  :host([theme='dark']) {
    color-scheme: dark;
    --skrypt-bg: #181818;
    --skrypt-stage: #101010;
    --skrypt-fg: #e4e4e4;
    --skrypt-muted: #ababab;
    --skrypt-border: #333333;
    --skrypt-surface: #222222;
    --skrypt-code-bg: #212121;
    --skrypt-accent: #e8a87c;
    --skrypt-active-bg: #1f1f1f;
    --skrypt-shadow: rgb(0 0 0 / 0.55);
  }
  /* Czerń dla ekranów OLED. Tekst nie jest czystą bielą, żeby nie „rozmywał” liter. */
  :host([theme='oled']) {
    color-scheme: dark;
    --skrypt-bg: #000000;
    --skrypt-stage: #000000;
    --skrypt-fg: #dcdcdc;
    --skrypt-muted: #a3a3a3;
    --skrypt-border: #2b2b2b;
    --skrypt-surface: #111111;
    --skrypt-code-bg: #141414;
    --skrypt-accent: #e8a87c;
    --skrypt-active-bg: #0f0f0f;
    --skrypt-shadow: rgb(0 0 0 / 0.8);
  }
  /* Wysoki kontrast, np. na projektor w sali wykładowej. */
  :host([theme='contrast']) {
    --skrypt-bg: #ffffff;
    --skrypt-stage: #e9e9e9;
    --skrypt-fg: #000000;
    --skrypt-muted: #404040;
    --skrypt-border: #6b6b6b;
    --skrypt-surface: #ececec;
    --skrypt-code-bg: #eeeeee;
    --skrypt-accent: #0033cc;
    --skrypt-shadow: rgb(0 0 0 / 0.3);
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
    line-height: var(--_leading);
    color: var(--_section-fg, var(--_fg));
    overflow-wrap: break-word;
    /* Wyrównanie do lewej: justowanie w przeglądarkach zostawia „rzeki” białych przerw. */
    text-align: left;
    hyphens: auto;
    -webkit-hyphens: auto;
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
    margin: 0 0 var(--_rhythm);
  }
  p {
    text-wrap: pretty;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.3;
    margin: calc(var(--_rhythm) * 1.5) 0 calc(var(--_rhythm) * 0.5);
    text-wrap: balance;
    hyphens: manual;
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
  code,
  pre,
  table {
    hyphens: none;
    -webkit-hyphens: none;
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
    font-style: italic;
  }
  table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-family: var(--_ui);
    font-size: 0.92em;
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

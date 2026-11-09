/** Tryb działania skrótów klawiszowych czytnika. */
export type KeyboardMode =
  /** Skróty działają, gdy fokus jest w czytniku (domyślnie). */
  | 'focus'
  /** Skróty działają na całej stronie. Dla aplikacji, w których czytnik zajmuje cały ekran. */
  | 'page'
  /** Bez skrótów. */
  | 'none';

export type KeyAction =
  { kind: 'section'; direction: 1 | -1 } | { kind: 'chapter'; direction: 1 | -1 };

export interface KeyEventLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
}

export interface KeyTargetLike {
  isContentEditable?: boolean;
  closest?(selector: string): unknown;
}

/** Elementy, które same obsługują strzałki lub tekst. Nie przejmujemy z nich klawiszy. */
const OWN_ARROWS = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="spinbutton"]',
].join(',');

/**
 * Zamienia naciśnięcie klawisza na akcję nawigacji (albo null, gdy klawisz nie jest nasz).
 *
 * ← / → : poprzednia / następna sekcja. Shift + ← / → : poprzedni / następny rozdział.
 * ↑ ↓ PgUp PgDn spacja Home End zostają zwykłym przewijaniem przeglądarki.
 */
export function interpretKey(event: KeyEventLike, target?: KeyTargetLike | null): KeyAction | null {
  if (event.defaultPrevented || event.isComposing || event.repeat) return null;
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return null;

  if (target?.isContentEditable) return null;
  if (target?.closest?.(OWN_ARROWS)) return null;

  const direction = event.key === 'ArrowRight' ? 1 : -1;
  return { kind: event.shiftKey ? 'chapter' : 'section', direction };
}

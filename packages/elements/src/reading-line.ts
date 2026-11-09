/** Linia czytania leży na tej części wysokości obszaru (od góry). */
export const READING_LINE_RATIO = 0.25;

export function readingLineY(visibleTop: number, visibleBottom: number): number {
  return visibleTop + READING_LINE_RATIO * (visibleBottom - visibleTop);
}

/**
 * Wybiera aktywną sekcję: ostatnią, której początek jest nad linią czytania (lub na niej).
 * Przed pierwszą sekcją aktywna jest pierwsza. Na końcu strony aktywna jest ostatnia,
 * bo krótka końcówka nigdy nie dojedzie do linii czytania.
 *
 * @param tops Położenia początków sekcji (Y, w kolejności czytania).
 * @returns Indeks sekcji albo -1 dla pustej listy.
 */
export function pickActiveIndex(tops: readonly number[], line: number, atEnd: boolean): number {
  if (tops.length === 0) return -1;
  if (atEnd) return tops.length - 1;

  let active = 0;
  for (const [index, top] of tops.entries()) {
    if (top <= line) active = index;
    else break;
  }
  return active;
}

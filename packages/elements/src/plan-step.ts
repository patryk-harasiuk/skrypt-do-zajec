/**
 * Czysta logika kroku strzałką w trybie czytania po sekcjach (bez DOM, łatwa do testowania).
 *
 * Współrzędne są względne wobec okna przeglądarki (jak `getBoundingClientRect`).
 */

export interface StepGeometry {
  /** Widoczny obszar czytania: bez przyklejonych pasków (górnego na telefonie, dolnego). */
  visibleTop: number;
  visibleBottom: number;
  /** Położenie bieżącej sekcji. */
  sectionTop: number;
  sectionBottom: number;
  /**
   * Wysokość, na której ląduje początek. Domyślnie linia lądowania sekcji (`anchorY`).
   * Pierwsza sekcja rozdziału ląduje inaczej: pokazujemy tytuł rozdziału.
   */
  landing?: number;
}

export type StepPlan =
  /** Przewiń treść o `delta` pikseli (dodatnie = w dół) i zostań w tej sekcji. */
  | { kind: 'scroll-within'; delta: number }
  /** Przejdź do sąsiedniej sekcji. */
  | { kind: 'go-to-adjacent' };

/** Początek sekcji po przejściu ląduje na tej części wysokości obszaru (od góry). */
export const ANCHOR_RATIO = 0.15;
/** Najwyższy skok w obrębie długiej sekcji, jako część wysokości obszaru. */
export const STEP_RATIO = 0.85;
/** Zapas przy dolnej krawędzi: koniec sekcji uznajemy za widoczny, gdy mieści się z tym zapasem. */
export const EDGE_MARGIN = 16;
/** Różnice mniejsze niż to nie uzasadniają przewijania w obrębie sekcji. */
const TOLERANCE = 8;

/** Wysokość (współrzędna Y), na której ląduje początek sekcji po przejściu. */
export function anchorY(visibleTop: number, visibleBottom: number): number {
  return visibleTop + Math.max(24, ANCHOR_RATIO * (visibleBottom - visibleTop));
}

/**
 * Decyduje, co zrobi strzałka.
 *
 * - →: jeśli koniec sekcji jest poza ekranem, przewija dalej w tej sekcji, w przeciwnym
 *   razie przechodzi do następnej.
 * - ←: jeśli początek sekcji jest nad linią lądowania, wraca do jej początku, w przeciwnym
 *   razie przechodzi do poprzedniej.
 *
 * Dzięki temu strzałka nie pomija bloku kodu ani tabeli w długiej sekcji.
 */
export function planStep(geometry: StepGeometry, direction: 1 | -1): StepPlan {
  const height = geometry.visibleBottom - geometry.visibleTop;

  if (direction === 1) {
    const overflow = geometry.sectionBottom - (geometry.visibleBottom - EDGE_MARGIN);
    if (overflow > TOLERANCE) {
      return { kind: 'scroll-within', delta: Math.min(STEP_RATIO * height, overflow) };
    }
    return { kind: 'go-to-adjacent' };
  }

  const anchor = geometry.landing ?? anchorY(geometry.visibleTop, geometry.visibleBottom);
  const hidden = anchor - geometry.sectionTop;
  if (hidden > TOLERANCE) {
    return { kind: 'scroll-within', delta: -Math.min(STEP_RATIO * height, hidden) };
  }
  return { kind: 'go-to-adjacent' };
}

/**
 * Pomocnicze funkcje przewijania. Czytnik jest osadzany w cudzej aplikacji, więc przewijać
 * może okno albo dowolny przewijalny element nadrzędny.
 */

/** Nadrzędny element przewijany przez użytkownika albo null, gdy przewijane jest okno. */
export function findScrollParent(start: Element): Element | null {
  let node: Node | null = start;
  while (node) {
    node = node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode;
    if (!(node instanceof Element) || node === document.body || node === document.documentElement) {
      return null;
    }
    const { overflowY } = getComputedStyle(node);
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) return node;
  }
  return null;
}

export interface Region {
  top: number;
  bottom: number;
}

/** Widoczny obszar przewijania we współrzędnych okna. */
export function visibleRegion(container: Element | null): Region {
  if (!container) return { top: 0, bottom: window.innerHeight };
  const rect = container.getBoundingClientRect();
  return { top: Math.max(0, rect.top), bottom: Math.min(window.innerHeight, rect.bottom) };
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function scrollPosition(container: Element | null): number {
  return container ? container.scrollTop : window.scrollY;
}

export function scrollByY(container: Element | null, top: number, smooth: boolean): void {
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
  if (container) container.scrollBy({ top, behavior });
  else window.scrollBy({ top, behavior });
}

/** Czy przewinięto do końca (z tolerancją na zaokrąglenia). */
export function isScrolledToEnd(container: Element | null): boolean {
  if (container) return container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
  const root = document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 2;
}

/**
 * Czeka, aż przewijanie się zakończy: pozycja nie zmienia się przez kilka klatek.
 * Działa tak samo dla przewijania płynnego i natychmiastowego, a także gdy przewijanie
 * w ogóle nie ruszyło. Zawsze kończy się po `timeoutMs`.
 *
 * Nie używamy `scrollend`, bo to zdarzenie nie pojawia się, gdy nic się nie przewinęło,
 * a przy przewinięciu natychmiastowym bywa wysłane, zanim zdążymy je podsłuchać.
 */
export function waitForScrollSettled(container: Element | null, timeoutMs = 3000): Promise<void> {
  const STABLE_FRAMES = 4;
  return new Promise((resolve) => {
    const started = performance.now();
    let last = scrollPosition(container);
    let stable = 0;
    const tick = (): void => {
      const now = scrollPosition(container);
      stable = now === last ? stable + 1 : 0;
      last = now;
      if (stable >= STABLE_FRAMES || performance.now() - started > timeoutMs) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

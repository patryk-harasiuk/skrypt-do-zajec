import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import longMarkdown from '../../../fixtures/dluga-sekcja.md?raw';
import pythonMarkdown from '../../../fixtures/python-podstawy.md?raw';
import './index.ts';
import type { SkryptReader } from './skrypt-reader.ts';

/**
 * Testy w prawdziwej przeglądarce: układ strony, przewijanie i klawisze.
 * jsdom nie liczy układu, więc geometrii nie da się tam sprawdzić.
 */

const raf = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Czeka, aż przewijanie się uspokoi (pozycja stała przez kilka klatek). */
async function settle(frames = 12, timeout = 5000): Promise<void> {
  const start = performance.now();
  let last = -1;
  let stable = 0;
  while (stable < frames && performance.now() - start < timeout) {
    await raf();
    stable = window.scrollY === last ? stable + 1 : 0;
    last = window.scrollY;
  }
}

async function mount(markdown: string): Promise<SkryptReader> {
  const reader = document.createElement('skrypt-reader');
  reader.markdown = markdown;
  document.body.append(reader);
  await reader.updateComplete;
  reader.focusReader();
  await settle(4);
  return reader;
}

const chapterEl = (reader: SkryptReader): HTMLElement =>
  reader.shadowRoot!.querySelector('skrypt-chapter')!;

const sections = (reader: SkryptReader): HTMLElement[] => [
  ...chapterEl(reader).shadowRoot!.querySelectorAll<HTMLElement>('skrypt-section'),
];

const activeId = (reader: SkryptReader): string | undefined =>
  sections(reader).find((section) => section.hasAttribute('active'))?.dataset['sectionId'];

const sectionById = (reader: SkryptReader, id: string): HTMLElement => {
  const found = sections(reader).find((section) => section.dataset['sectionId'] === id);
  if (!found) throw new Error(`Brak sekcji ${id}`);
  return found;
};

/** Górna i dolna granica widocznego obszaru czytania (bez pasków). */
function region(reader: SkryptReader): { top: number; bottom: number } {
  const topBar = reader.shadowRoot!.querySelector('.bar')!.getBoundingClientRect();
  const bottomBar = reader.shadowRoot!.querySelector('skrypt-section-bar')?.getBoundingClientRect();
  return {
    top: topBar.height > 0 ? topBar.bottom : 0,
    bottom: bottomBar && bottomBar.height > 0 ? bottomBar.top : window.innerHeight,
  };
}

/** Linia lądowania: 15% wysokości obszaru czytania. */
function landing(reader: SkryptReader): number {
  const { top, bottom } = region(reader);
  return top + Math.max(24, 0.15 * (bottom - top));
}

async function press(key: string): Promise<void> {
  await userEvent.keyboard(`{${key}}`);
  await settle();
}

beforeEach(async () => {
  document.body.style.margin = '0';
  await page.viewport(1100, 700);
});

afterEach(() => {
  document.body.replaceChildren();
  window.scrollTo(0, 0);
});

const LONG_FLOW = [
  'rozdział-pierwszy-s1',
  'krótka-sekcja',
  'bardzo-długa-sekcja',
  'rozdział-pierwszy-s4',
  'ostatnia-sekcja-rozdziału',
  'jedyna-sekcja',
];

describe('strzałka → w dokumencie z długą sekcją', () => {
  it('przechodzi przez wszystkie sekcje po kolei i niczego nie pomija', async () => {
    const reader = await mount(longMarkdown);
    const visited: string[] = [activeId(reader)!];
    const presses: Record<string, number> = {};

    for (let i = 0; i < 40; i++) {
      const before = activeId(reader)!;
      const element = sectionById(reader, before);
      const barTop = region(reader).bottom;
      const yBefore = window.scrollY;
      const chapterBefore = reader
        .shadowRoot!.querySelector('skrypt-chapter')!
        .shadowRoot!.querySelector('.title')?.textContent;

      await press('ArrowRight');
      presses[before] = (presses[before] ?? 0) + 1;

      const after = activeId(reader)!;
      if (after !== before) {
        // Zanim wyszliśmy z sekcji, jej koniec był widoczny. Dotyczy tej samej strony.
        const chapterAfter = reader
          .shadowRoot!.querySelector('skrypt-chapter')!
          .shadowRoot!.querySelector('.title')?.textContent;
        if (chapterAfter === chapterBefore) {
          expect(element.getBoundingClientRect().bottom).toBeLessThanOrEqual(barTop + 40);
        }
        visited.push(after);
      } else if (window.scrollY === yBefore) {
        break;
      }
    }

    expect(visited).toEqual(LONG_FLOW);
    expect(presses['bardzo-długa-sekcja']).toBeGreaterThanOrEqual(3);
    expect(presses['krótka-sekcja']).toBe(1);
  });

  it('ustawia początek sekcji na linii lądowania (15% wysokości obszaru)', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    expect(activeId(reader)).toBe('krótka-sekcja');
    const top = sectionById(reader, 'krótka-sekcja').getBoundingClientRect().top;
    expect(Math.abs(top - landing(reader))).toBeLessThanOrEqual(3);
  });

  it('w długiej sekcji przewija treść, nie zmieniając sekcji', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    await press('ArrowRight');
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');

    const y = window.scrollY;
    await press('ArrowRight');
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');
    expect(window.scrollY).toBeGreaterThan(y);
    // Skok jest mniejszy niż wysokość obszaru: kontekst z poprzedniego ekranu zostaje.
    const { top, bottom } = region(reader);
    expect(window.scrollY - y).toBeLessThanOrEqual(0.85 * (bottom - top) + 2);
  });
});

describe('strzałka ←', () => {
  it('w długiej sekcji najpierw wraca do jej początku, potem do poprzedniej sekcji', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    await press('ArrowRight');
    await press('ArrowRight'); // w głąb długiej sekcji
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');

    await press('ArrowLeft');
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');
    const top = sectionById(reader, 'bardzo-długa-sekcja').getBoundingClientRect().top;
    expect(Math.abs(top - landing(reader))).toBeLessThanOrEqual(3);

    await press('ArrowLeft');
    expect(activeId(reader)).toBe('krótka-sekcja');
  });

  it('w pierwszej sekcji wraca na górę strony (okładka ze spisem treści)', async () => {
    await mount(longMarkdown);
    window.scrollTo(0, 120);
    await settle(4);
    await press('ArrowLeft');
    expect(window.scrollY).toBe(0);
  });
});

describe('rozdziały', () => {
  it('Shift + → otwiera następny rozdział od jego tytułu', async () => {
    const reader = await mount(longMarkdown);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await settle();
    expect(activeId(reader)).toBe('jedyna-sekcja');
    // Krótki rozdział nie pozwala przewinąć strony do linii lądowania, ale tytuł ma być widoczny
    // na samej górze obszaru czytania.
    const title = chapterEl(reader).getBoundingClientRect().top;
    expect(title).toBeGreaterThanOrEqual(region(reader).top);
    expect(title).toBeLessThanOrEqual(region(reader).top + 40);
  });
});

describe('zwykłe przewijanie', () => {
  it('zmienia aktywną sekcję na podstawie linii czytania i niczego nie przewija samo', async () => {
    const reader = await mount(longMarkdown);
    const long = sectionById(reader, 'bardzo-długa-sekcja');
    const { top, bottom } = region(reader);
    const line = top + 0.25 * (bottom - top);
    const target = long.getBoundingClientRect().top + window.scrollY - line + 400;

    window.scrollTo(0, target);
    await settle();

    expect(activeId(reader)).toBe('bardzo-długa-sekcja');
    expect(Math.abs(window.scrollY - target)).toBeLessThanOrEqual(1);
  });

  it('po przewinięciu myszą strzałka rusza od sekcji, w której jesteśmy', async () => {
    const reader = await mount(longMarkdown);
    const ok = sectionById(reader, 'ostatnia-sekcja-rozdziału');
    const { top, bottom } = region(reader);
    window.scrollTo(
      0,
      ok.getBoundingClientRect().top + window.scrollY - (top + 0.25 * (bottom - top)),
    );
    await settle();
    expect(activeId(reader)).toBe('ostatnia-sekcja-rozdziału');

    await press('ArrowLeft');
    expect(activeId(reader)).toBe('rozdział-pierwszy-s4');
  });

  it('strzałki góra i dół przewijają stronę bez zmiany sekcji', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    await press('ArrowRight');
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');
    const y = window.scrollY;
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await settle();
    expect(window.scrollY).toBeGreaterThan(y);
    expect(activeId(reader)).toBe('bardzo-długa-sekcja');
  });
});

describe('fokus', () => {
  it('w trybie focus klawisze poza czytnikiem niczego nie zmieniają', async () => {
    const reader = await mount(longMarkdown);
    (document.activeElement as HTMLElement | null)?.blur();
    const input = document.createElement('input');
    // Przyklejone do okna, żeby ustawienie fokusu nie przewinęło strony.
    input.style.cssText = 'position: fixed; top: 0; right: 0; z-index: 10';
    document.body.append(input);
    input.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle(4);
    expect(activeId(reader)).toBe('rozdział-pierwszy-s1');
  });

  it('kliknięcie w treść przenosi fokus do czytnika, więc strzałki działają', async () => {
    const reader = await mount(longMarkdown);
    (document.activeElement as HTMLElement | null)?.blur();
    sections(reader)[0]!.shadowRoot!.querySelector<HTMLElement>('skrypt-block-markdown')!.click();
    reader.focusReader();
    await press('ArrowRight');
    expect(activeId(reader)).toBe('krótka-sekcja');
  });
});

describe('tryb ciągły', () => {
  it('strzałki działają tak samo, ale sekcje nie są przygaszone', async () => {
    const reader = await mount(longMarkdown);
    reader.mode = 'continuous';
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('skrypt-section-bar')).toBeNull();

    await press('ArrowRight');
    expect(activeId(reader)).toBe('krótka-sekcja');
    const top = sectionById(reader, 'krótka-sekcja').getBoundingClientRect().top;
    expect(Math.abs(top - landing(reader))).toBeLessThanOrEqual(3);
  });
});

describe('tryb po sekcjach: wygląd', () => {
  it('sekcje nieaktywne mają inny kolor tekstu niż aktywna, ale kontrast pozostaje czytelny', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    const colorOf = (id: string): string => {
      const block = sectionById(reader, id).shadowRoot!.querySelector('skrypt-block-markdown')!;
      return getComputedStyle(block.shadowRoot!.querySelector('.content')!).color;
    };
    const active = colorOf('krótka-sekcja');
    const dimmed = colorOf('rozdział-pierwszy-s1');
    expect(dimmed).not.toBe(active);

    const luminance = (rgb: string): number => {
      const [r, g, b] = rgb
        .match(/\d+(\.\d+)?/g)!
        .slice(0, 3)
        .map((v) => {
          const c = Number(v) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string): number => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(contrast(dimmed, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5);
  });

  it('znacznik na marginesie jest tylko przy aktywnej sekcji', async () => {
    const reader = await mount(longMarkdown);
    await press('ArrowRight');
    const border = (id: string): string =>
      getComputedStyle(sectionById(reader, id)).borderLeftColor;
    expect(border('krótka-sekcja')).not.toBe(border('rozdział-pierwszy-s1'));
  });
});

describe('telefon', () => {
  it('początek sekcji ląduje pod przyklejonym paskiem, a przyciski paska przechodzą dalej', async () => {
    await page.viewport(390, 720);
    const reader = await mount(pythonMarkdown);
    const topBar = reader.shadowRoot!.querySelector('.bar')!.getBoundingClientRect();
    expect(topBar.height).toBeGreaterThan(0);

    // Na telefonie okładka ze spisem jest wysoka, więc najpierw przewijamy w obrębie
    // wstępu. Klikamy › aż do trzeciej sekcji, a pozycja ma być przy tym kolejno poprawna.
    const bar = reader.shadowRoot!.querySelector('skrypt-section-bar')!;
    const seen: string[] = [activeId(reader)!];
    for (let i = 0; i < 8 && activeId(reader) !== 'zmienne-s2'; i++) {
      bar.shadowRoot!.querySelector<HTMLButtonElement>('button.next')!.click();
      await settle();
      if (activeId(reader) !== seen.at(-1)) seen.push(activeId(reader)!);
    }

    expect(seen).toEqual(['wstęp-s1', 'zmienne', 'zmienne-s2']);
    const top = sectionById(reader, 'zmienne-s2').getBoundingClientRect().top;
    expect(top).toBeGreaterThanOrEqual(topBar.bottom);
    expect(Math.abs(top - landing(reader))).toBeLessThanOrEqual(3);
  });
});

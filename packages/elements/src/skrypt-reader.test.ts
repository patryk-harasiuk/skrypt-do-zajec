// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './index.ts';
import type { SkryptReader } from './skrypt-reader.ts';
import { readFixture } from './test-utils.ts';

const fixture = readFixture;

async function mount(markdown: string): Promise<SkryptReader> {
  const reader = document.createElement('skrypt-reader');
  reader.markdown = markdown;
  document.body.append(reader);
  await reader.updateComplete;
  return reader;
}

const tocs = (reader: SkryptReader): NodeListOf<HTMLElement> =>
  reader.shadowRoot!.querySelectorAll('skrypt-toc');

const tocButtons = (toc: Element): HTMLButtonElement[] => [
  ...toc.shadowRoot!.querySelectorAll('button'),
];

const chapterTitle = (reader: SkryptReader): string | undefined =>
  reader
    .shadowRoot!.querySelector('skrypt-chapter')
    ?.shadowRoot?.querySelector('.title')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

beforeEach(() => {
  // jsdom nie implementuje przewijania okna.
  window.scrollBy = vi.fn();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('<skrypt-reader>', () => {
  it('bez treści pokazuje komunikat', async () => {
    const reader = document.createElement('skrypt-reader');
    document.body.append(reader);
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('.message')?.textContent).toContain('Nie załadowano');
  });

  it('pokazuje tytuł, spis treści na początku i pierwszy rozdział', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const root = reader.shadowRoot!;

    expect(root.querySelector('.doc-title')?.textContent).toBe('Podstawy programowania w Pythonie');
    // Spis w okładce (przed treścią) i w panelu bocznym.
    expect(root.querySelector('.cover skrypt-toc')).not.toBeNull();
    expect(tocs(reader)).toHaveLength(2);
    expect(chapterTitle(reader)).toBe('Wstęp');
  });

  it('spis treści ma numerację rozdziałów i sekcji', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const labels = tocButtons(tocs(reader)[0]!).map((b) =>
      b.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toEqual([
      'Wstęp',
      '1 Zmienne i typy',
      '1.1 Zmienne',
      '1.2 Typy liczbowe',
      '2 Pętle',
      '2.1 Pętla for',
      '2.2 Schemat działania',
    ]);
  });

  it('kliknięcie w spis przenosi do innego rozdziału i oznacza pozycję', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const sidebarToc = reader.shadowRoot!.querySelector('.sidebar skrypt-toc')!;

    const target = tocButtons(sidebarToc).find((b) => b.textContent!.includes('Pętla for'))!;
    target.click();
    await reader.updateComplete;

    expect(chapterTitle(reader)).toBe('2 Pętle');
    // Okładka znika poza pierwszym rozdziałem.
    expect(reader.shadowRoot!.querySelector('.cover')).toBeNull();
    const current = tocButtons(reader.shadowRoot!.querySelector('.sidebar skrypt-toc')!).filter(
      (b) => b.getAttribute('aria-current') === 'location',
    );
    expect(current.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      '2.1 Pętla for',
    ]);
  });

  it('przyciski rozdziałów przechodzą dalej i wstecz', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const next = reader.shadowRoot!.querySelector<HTMLButtonElement>('.chapter-nav .next')!;
    next.click();
    await reader.updateComplete;
    expect(chapterTitle(reader)).toBe('1 Zmienne i typy');

    reader.shadowRoot!.querySelector<HTMLButtonElement>('.chapter-nav button:not(.next)')!.click();
    await reader.updateComplete;
    expect(chapterTitle(reader)).toBe('Wstęp');
  });

  it('link wewnętrzny #id w treści przenosi do sekcji', async () => {
    const reader = await mount('# T\n\n## A\n\n[do B](#sekcja-b)\n\n## B\n\n### Sekcja B\n\nx\n');
    const chapter = reader.shadowRoot!.querySelector('skrypt-chapter')!;
    const block = chapter
      .shadowRoot!.querySelector('skrypt-section')!
      .shadowRoot!.querySelector('skrypt-block-markdown')!;
    block.shadowRoot!.querySelector('a')!.click();
    await reader.updateComplete;
    expect(chapterTitle(reader)).toBe('2 B');
  });

  it('wysyła skrypt-ready oraz skrypt-diagnostics', async () => {
    const reader = document.createElement('skrypt-reader');
    const ready = vi.fn();
    const diagnostics = vi.fn();
    reader.addEventListener('skrypt-ready', ready);
    reader.addEventListener('skrypt-diagnostics', diagnostics);
    reader.markdown = fixture('bledy-autora.md');
    document.body.append(reader);
    await reader.updateComplete;

    expect(ready).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledTimes(1);
    expect((diagnostics.mock.calls[0]![0] as CustomEvent).detail.length).toBeGreaterThan(0);
  });

  it('zachowuje pozycję po podmianie treści, jeśli sekcja nadal istnieje', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    reader.goToSection('pętla-for');
    await reader.updateComplete;

    reader.markdown = fixture('python-podstawy.md') + '\nDopisek.\n';
    await reader.updateComplete;
    expect(chapterTitle(reader)).toBe('2 Pętle');
  });

  it('nie wykonuje skryptów z treści (xss.md)', async () => {
    const reader = await mount(fixture('xss.md'));
    const section = reader
      .shadowRoot!.querySelector('skrypt-chapter')!
      .shadowRoot!.querySelector('skrypt-section')!;
    const block = section.shadowRoot!.querySelector('skrypt-block-markdown')!;
    expect(block.shadowRoot!.querySelector('script')).toBeNull();
    expect(block.shadowRoot!.innerHTML).not.toMatch(/onerror/i);
  });

  it('akceptuje gotowy ScriptDocument zamiast markdown', async () => {
    const { parseScript } = await import('@skrypt/core');
    const reader = document.createElement('skrypt-reader');
    reader.document = parseScript('# Gotowy\n\n## R\n\nx').document;
    document.body.append(reader);
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('.doc-title')?.textContent).toBe('Gotowy');
  });
});

describe('<skrypt-reader> nawigacja po sekcjach', () => {
  const key = (reader: SkryptReader, name: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    });
    reader.shadowRoot!.querySelector('main')!.dispatchEvent(event);
    return event;
  };

  const activeSection = (reader: SkryptReader): string | undefined =>
    reader
      .shadowRoot!.querySelector('skrypt-chapter')
      ?.shadowRoot?.querySelector('skrypt-section[active]')
      ?.getAttribute('data-section-id') ?? undefined;

  it('domyślnie działa tryb po sekcjach z paskiem u dołu', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    expect(reader.mode).toBe('sections');
    expect(reader.keyboard).toBe('focus');
    expect(reader.shadowRoot!.querySelector('skrypt-section-bar')).not.toBeNull();
    expect(reader.shadowRoot!.querySelector('.mode-toggle')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('→ przechodzi do następnej sekcji i zmienia aktywną sekcję w treści', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    expect(activeSection(reader)).toBe('wstęp-s1');

    const event = key(reader, 'ArrowRight');
    await reader.updateComplete;

    expect(event.defaultPrevented).toBe(true);
    expect(chapterTitle(reader)).toBe('1 Zmienne i typy');
    expect(activeSection(reader)).toBe('zmienne');
  });

  it('Shift + → przechodzi do następnego rozdziału, omijając sekcje', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    key(reader, 'ArrowRight', { shiftKey: true });
    key(reader, 'ArrowRight', { shiftKey: true });
    await reader.updateComplete;
    expect(chapterTitle(reader)).toBe('2 Pętle');
    expect(activeSection(reader)).toBe('pętla-for');
  });

  it('strzałki góra i dół nie zmieniają sekcji ani nie są blokowane', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const down = key(reader, 'ArrowDown');
    const up = key(reader, 'ArrowUp');
    await reader.updateComplete;
    expect(down.defaultPrevented).toBe(false);
    expect(up.defaultPrevented).toBe(false);
    expect(activeSection(reader)).toBe('wstęp-s1');
  });

  it('na końcu skryptu → nie blokuje domyślnej akcji przeglądarki', async () => {
    const reader = await mount('# T\n\n## R\n\nx');
    const event = key(reader, 'ArrowRight');
    expect(event.defaultPrevented).toBe(false);
  });

  it('keyboard="none" wyłącza skróty', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    reader.keyboard = 'none';
    await reader.updateComplete;
    key(reader, 'ArrowRight');
    await reader.updateComplete;
    expect(activeSection(reader)).toBe('wstęp-s1');
  });

  it('keyboard="page" łapie klawisze z całej strony, ale nie z pól tekstowych', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    reader.keyboard = 'page';
    await reader.updateComplete;

    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await reader.updateComplete;
    expect(activeSection(reader)).toBe('wstęp-s1');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await reader.updateComplete;
    expect(activeSection(reader)).toBe('zmienne');
  });

  it('metody nextSection i previousSection działają jak strzałki', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    expect(reader.nextSection()).toBe(true);
    await reader.updateComplete;
    expect(activeSection(reader)).toBe('zmienne');
  });

  it('wysyła skrypt-navigate z przyczyną zmiany', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const listener = vi.fn();
    reader.addEventListener('skrypt-navigate', listener);

    key(reader, 'ArrowRight');
    await reader.updateComplete;

    const detail = (listener.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail).toEqual({ chapterId: 'zmienne', sectionId: 'zmienne', cause: 'navigate' });
  });

  it('klik w przygaszoną sekcję czyni ją aktywną bez przewijania (cause: observe)', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    key(reader, 'ArrowRight');
    await reader.updateComplete;
    const listener = vi.fn();
    reader.addEventListener('skrypt-navigate', listener);

    const sections = reader
      .shadowRoot!.querySelector('skrypt-chapter')!
      .shadowRoot!.querySelectorAll('skrypt-section');
    (sections[2] as HTMLElement).click();
    await reader.updateComplete;

    expect(activeSection(reader)).toBe('typy-liczbowe');
    expect((listener.mock.calls[0]![0] as CustomEvent).detail.cause).toBe('observe');
  });

  it('przełącznik trybu usuwa pasek i znaczniki, ale zostawia pozycję', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    key(reader, 'ArrowRight');
    await reader.updateComplete;
    const changed = vi.fn();
    reader.addEventListener('skrypt-mode-change', changed);

    reader.shadowRoot!.querySelector<HTMLButtonElement>('.mode-toggle')!.click();
    await reader.updateComplete;

    expect(reader.mode).toBe('continuous');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(reader.shadowRoot!.querySelector('skrypt-section-bar')).toBeNull();
    expect(chapterTitle(reader)).toBe('1 Zmienne i typy');

    // Strzałki działają także w trybie ciągłym.
    key(reader, 'ArrowRight');
    await reader.updateComplete;
    expect(activeSection(reader)).toBe('zmienne-s2');
  });

  it('pasek pokazuje tytuł i pozycję, a przycisk › przechodzi dalej', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const bar = reader.shadowRoot!.querySelector('skrypt-section-bar')!;
    await (bar as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect(bar.shadowRoot!.textContent).toContain('Sekcja 1 z 1');

    bar.shadowRoot!.querySelector<HTMLButtonElement>('button.next')!.click();
    await reader.updateComplete;
    const next = reader.shadowRoot!.querySelector('skrypt-section-bar')!;
    await (next as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect(next.shadowRoot!.querySelector('.name')?.textContent).toBe('1.1 Zmienne');
    expect(next.shadowRoot!.textContent).toContain('Sekcja 1 z 3');
    expect(next.shadowRoot!.textContent).toContain('Rozdział 2 z 3');
  });

  it('ogłasza przejście w regionie aria-live', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    key(reader, 'ArrowRight');
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('[aria-live]')?.textContent).toBe(
      'Sekcja: 1.1 Zmienne',
    );
  });

  it('← w sekcji, której początek jest nad linią lądowania, wraca na jej początek', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    key(reader, 'ArrowRight');
    await reader.updateComplete;

    // jsdom nie liczy układu strony, więc podajemy położenie sekcji ręcznie.
    const original = HTMLElement.prototype.getBoundingClientRect;
    const rect = (top: number, bottom: number): DOMRect =>
      ({
        top,
        bottom,
        left: 0,
        right: 0,
        width: 100,
        height: bottom - top,
        x: 0,
        y: top,
      }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.tagName === 'SKRYPT-SECTION' ? rect(-300, 400) : original.call(this);
    });
    const listener = vi.fn();
    reader.addEventListener('skrypt-navigate', listener);

    const event = key(reader, 'ArrowLeft');
    await reader.updateComplete;

    expect(event.defaultPrevented).toBe(true);
    const options = (window.scrollBy as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as ScrollToOptions;
    expect(options.top).toBeCloseTo(-415.2); // linia lądowania 115,2 minus początek sekcji -300
    expect(options.behavior).toBe('smooth');
    expect(listener).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

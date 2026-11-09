// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('przewija do sekcji w obrębie rozdziału', async () => {
    const reader = await mount(fixture('python-podstawy.md'));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    const toc = reader.shadowRoot!.querySelector('.sidebar skrypt-toc')!;
    tocButtons(toc)
      .find((b) => b.textContent!.includes('Typy liczbowe'))!
      .click();
    await reader.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scroll).toHaveBeenCalledTimes(1);
    const element = scroll.mock.contexts[0] as HTMLElement;
    expect(element.dataset['sectionId']).toBe('typy-liczbowe');
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

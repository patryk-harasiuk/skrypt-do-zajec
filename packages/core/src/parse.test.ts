import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseScript } from './parse.ts';
import type { Chapter, Diagnostic, ScriptDocument } from './model.ts';

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8');

const codes = (diagnostics: Diagnostic[]): string[] => diagnostics.map((d) => d.code);

/** Uproszczony zarys struktury: rozdział → sekcje (id + tytuł). */
const outline = (doc: ScriptDocument): unknown =>
  doc.chapters.map((c) => [c.id, c.sections.map((s) => [s.id, s.title])]);

describe('python-podstawy.md (realistyczny skrypt)', () => {
  const { document: doc, diagnostics } = parseScript(fixture('python-podstawy.md'));

  it('czyta metadane z front matter', () => {
    expect(doc.id).toBe('python-podstawy');
    expect(doc.title).toBe('Podstawy programowania w Pythonie');
    expect(doc.version).toBe('1.2');
  });

  it('nie zgłasza uwag', () => {
    expect(diagnostics).toEqual([]);
  });

  it('dzieli na rozdziały i sekcje', () => {
    expect(outline(doc)).toEqual([
      ['wstęp', [['wstęp-s1', null]]],
      [
        'zmienne',
        [
          ['zmienne', 'Zmienne'],
          ['zmienne-s2', null],
          ['typy-liczbowe', 'Typy liczbowe'],
        ],
      ],
      [
        'pętle',
        [
          ['pętla-for', 'Pętla for'],
          ['schemat-działania', 'Schemat działania'],
          ['pętle-s3', null],
        ],
      ],
    ]);
  });

  it('buduje spis treści z numeracją', () => {
    expect(
      doc.toc.map((c) => [c.number, c.title, c.sectionId, c.children.map((s) => s.number)]),
    ).toEqual([
      [null, 'Wstęp', 'wstęp-s1', []],
      ['1', 'Zmienne i typy', 'zmienne', ['1.1', '1.2']],
      ['2', 'Pętle', 'pętla-for', ['2.1', '2.2']],
    ]);
  });

  it('wydziela diagram mermaid jako osobny blok', () => {
    const section = doc.chapters[2]?.sections[1];
    expect(section?.blocks.map((b) => b.type)).toEqual(['mermaid']);
    expect(section?.blocks[0]).toMatchObject({ type: 'mermaid' });
  });

  it('zachowuje wzory i kod w bloku markdown', () => {
    const blocks = doc.chapters[1]?.sections[2]?.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'markdown' });
    expect(JSON.stringify(blocks[0])).toContain('\\\\frac{-b');
  });

  it('zbiera definicje linków referencyjnych', () => {
    expect(doc.linkDefinitions).toContain('[py]: https://docs.python.org/3/');
  });

  it('jest serializowalny do JSON bez strat', () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it('jest deterministyczny', () => {
    expect(parseScript(fixture('python-podstawy.md'))).toEqual({ document: doc, diagnostics });
  });
});

describe('bledy-autora.md (przypadki brzegowe)', () => {
  const { document: doc, diagnostics } = parseScript(fixture('bledy-autora.md'));

  it('zgłasza uwagi z numerami linii', () => {
    expect(diagnostics.map((d) => [d.code, d.line])).toEqual([
      ['setext-heading', 9],
      ['dash-separator', 14],
      ['empty-section', 18],
      ['empty-section', 20],
      ['empty-chapter', 22],
      ['duplicate-id', 28],
      ['extra-h1', 32],
    ]);
  });

  it('treść przed ## trafia do niejawnego rozdziału, także ### przed ##', () => {
    const first = doc.chapters[0] as Chapter;
    expect(first.implicit).toBe(true);
    expect(first.sections.map((s) => s.title)).toEqual([null, 'Sekcja przed rozdziałem']);
  });

  it('nagłówek setext tworzy rozdział (ostrzeżenie), a --- dzieli sekcję', () => {
    expect(doc.chapters.map((c) => c.title)).toEqual([
      'Wstęp',
      'Nagłówek podkreślony',
      'Pusty rozdział',
      'Powtórzony',
      'Powtórzony',
    ]);
    expect(doc.chapters[1]?.sections).toHaveLength(2);
  });

  it('duplikaty dostają kolejne sufiksy, a id są unikalne', () => {
    const chapterIds = doc.chapters.map((c) => c.id);
    const sectionIds = doc.chapters.flatMap((c) => c.sections.map((s) => s.id));
    expect(new Set(chapterIds).size).toBe(chapterIds.length);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(doc.chapters.map((c) => c.id).slice(3)).toEqual(['powtórzony', 'powtórzony-2']);
  });

  it('pusty rozdział ma jedną pustą sekcję', () => {
    const empty = doc.chapters[2] as Chapter;
    expect(empty.sections).toHaveLength(1);
    expect(empty.sections[0]?.blocks).toEqual([]);
  });

  it('dodatkowy H1 zostaje w treści', () => {
    const last = doc.chapters.at(-1) as Chapter;
    expect(JSON.stringify(last.sections)).toContain('# Drugi tytuł');
  });
});

describe('xss.md', () => {
  it('nie modyfikuje surowego HTML (sanityzacja należy do warstwy render)', () => {
    const { document: doc, diagnostics } = parseScript(fixture('xss.md'));
    expect(diagnostics).toEqual([]);
    expect(JSON.stringify(doc.chapters)).toContain("<script>alert('xss')</script>");
  });
});

describe('front matter', () => {
  it('nie tworzy rozdziału z linii YAML', () => {
    const { document: doc } = parseScript('---\ntitle: Tytuł z YAML\n---\n\n## Rozdział\n\nTreść');
    expect(doc.title).toBe('Tytuł z YAML');
    expect(doc.chapters.map((c) => c.title)).toEqual(['Rozdział']);
  });

  it('front matter ma pierwszeństwo przed H1, a H1 nie trafia do treści', () => {
    const { document: doc, diagnostics } = parseScript('---\ntitle: A\n---\n# B\n\n## R\n\nx');
    expect(doc.title).toBe('A');
    expect(diagnostics).toEqual([]);
    expect(doc.chapters).toHaveLength(1);
  });

  it('numeruje linie względem pliku, razem z front matter', () => {
    const { diagnostics } = parseScript('---\ntitle: A\n---\n\n## R\n\ntekst\n\n***\n\n***\n\nx');
    expect(diagnostics).toMatchObject([{ code: 'empty-section', line: 9 }]);
  });

  it('zgłasza błąd niepoprawnego YAML i parsuje resztę', () => {
    const { document: doc, diagnostics } = parseScript(
      '---\ntitle: [nie zamknięte\n---\n# T\n\n## R',
    );
    expect(codes(diagnostics)).toContain('invalid-front-matter');
    expect(doc.title).toBe('T');
  });

  it('dwa separatory otaczające zwykły tekst to nie front matter', () => {
    const { document: doc } = parseScript('---\nZwykły tekst\n---\n\n## R\n\nx');
    expect(JSON.stringify(doc.chapters[0])).toContain('Zwykły tekst');
  });

  it('akceptuje CRLF i BOM', () => {
    const { document: doc } = parseScript('\uFEFF---\r\ntitle: A\r\n---\r\n\r\n## R\r\n\r\nx');
    expect(doc.title).toBe('A');
    expect(doc.chapters[0]?.id).toBe('r');
  });
});

describe('identyfikatory', () => {
  it('jawne {#id} wygrywa ze slugiem i nie trafia do tytułu', () => {
    const { document: doc } = parseScript('# T\n\n## Pętle {#petle}\n\nx');
    expect(doc.chapters[0]).toMatchObject({ id: 'petle', title: 'Pętle' });
  });

  it('nie zmieniają się po dopisaniu sekcji w innym rozdziale', () => {
    const base = '# T\n\n## A\n\n### Jeden\n\nx\n\n## B\n\n### Dwa\n\ny\n';
    const edited = base.replace('## B', '## Nowy\n\n### Wstawiona\n\nz\n\n## B');
    const idsOf = (md: string): string[] =>
      parseScript(md).document.chapters.flatMap((c) => [c.id, ...c.sections.map((s) => s.id)]);
    const before = idsOf(base);
    const after = idsOf(edited);
    for (const id of before) expect(after).toContain(id);
  });

  it('wymyśla id, gdy tytuł nie daje sluga', () => {
    const { document: doc } = parseScript('# T\n\n## ???\n\nx');
    expect(doc.chapters[0]?.id).toBe('rozdzial-1');
  });

  it('jawne id bloku (id=...) trafia do bloku mermaid', () => {
    const { document: doc } = parseScript(
      '# T\n\n## R\n\n```mermaid id=schemat-1\ngraph TD\n```\n',
    );
    expect(doc.chapters[0]?.sections[0]?.blocks[0]).toMatchObject({
      type: 'mermaid',
      id: 'schemat-1',
    });
  });

  it('zmiana treści zmienia contentHash, a ten sam tekst daje ten sam', () => {
    const a = parseScript('# T\n\n## R\n\nx').document.contentHash;
    expect(parseScript('# T\n\n## R\n\nx').document.contentHash).toBe(a);
    expect(parseScript('# T\n\n## R\n\ny').document.contentHash).not.toBe(a);
  });
});

describe('struktura', () => {
  it('pusty plik daje pusty dokument i uwagę o braku tytułu', () => {
    const { document: doc, diagnostics } = parseScript('');
    expect(doc.chapters).toEqual([]);
    expect(doc.toc).toEqual([]);
    expect(codes(diagnostics)).toEqual(['missing-title']);
  });

  it('nagłówki #### i głębsze oraz zagnieżdżone w listach i cytatach to zwykła treść', () => {
    const { document: doc } = parseScript(
      '# T\n\n## R\n\n#### Podpunkt\n\n> ### W cytacie\n\n- ### W liście\n',
    );
    expect(doc.chapters[0]?.sections).toHaveLength(1);
    expect(doc.chapters[0]?.sections[0]?.blocks).toHaveLength(1);
  });

  it('niezamknięty blok kodu z ``` nie gubi treści', () => {
    const { document: doc } = parseScript('# T\n\n## R\n\n```python\nprint(1)\n\n### Nie nagłówek');
    expect(doc.chapters[0]?.sections).toHaveLength(1);
    expect(JSON.stringify(doc.chapters[0])).toContain('### Nie nagłówek');
  });

  it('znaki ### i *** w bloku kodu nie dzielą sekcji', () => {
    const { document: doc } = parseScript('# T\n\n## R\n\n```md\n### x\n\n***\n```\n');
    expect(doc.chapters[0]?.sections).toHaveLength(1);
  });

  it('nieznany język bloku kodu zostaje zwykłym kodem', () => {
    const { document: doc } = parseScript('# T\n\n## R\n\n```quiz id=a\npytanie\n```\n');
    expect(doc.chapters[0]?.sections[0]?.blocks[0]).toMatchObject({ type: 'markdown' });
  });

  it('kod i tekst przed oraz po diagramie tworzą trzy bloki', () => {
    const { document: doc } = parseScript(
      '# T\n\n## R\n\nPrzed\n\n```mermaid\ngraph TD\n```\n\nPo\n',
    );
    expect(doc.chapters[0]?.sections[0]?.blocks.map((b) => b.type)).toEqual([
      'markdown',
      'mermaid',
      'markdown',
    ]);
  });

  it('zachowuje wcięcie kodu na początku bloku', () => {
    const { document: doc } = parseScript('# T\n\n## R\n\n    kod = 1\n');
    expect(doc.chapters[0]?.sections[0]?.blocks[0]).toMatchObject({ source: '    kod = 1' });
  });

  it('rozdział po H2 z samym ### nie ma pustej sekcji wstępnej', () => {
    const { document: doc, diagnostics } = parseScript('# T\n\n## R\n\n### A\n\nx\n');
    expect(doc.chapters[0]?.sections.map((s) => s.title)).toEqual(['A']);
    expect(diagnostics).toEqual([]);
  });
});

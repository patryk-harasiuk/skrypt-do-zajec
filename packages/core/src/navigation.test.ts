import { describe, expect, it, vi } from 'vitest';
import { activeTocEntry, createReaderStore, findSection, listSections } from './navigation.ts';
import { parseScript } from './parse.ts';

const { document: doc } = parseScript(
  [
    '# T',
    '',
    'Wstęp.',
    '',
    '## A',
    '',
    'Tekst A.',
    '',
    '***',
    '',
    'Bez tytułu.',
    '',
    '### A2',
    '',
    'Tekst A2.',
    '',
    '***',
    '',
    'Po A2.',
    '',
    '## B',
    '',
    'Tekst B.',
    '',
    '## C',
    '',
    'Tekst C.',
  ].join('\n'),
);

describe('listSections / findSection', () => {
  it('zwraca sekcje w kolejności czytania', () => {
    expect(listSections(doc).map((s) => [s.chapterId, s.sectionId, s.index])).toEqual([
      ['wstęp', 'wstęp-s1', 0],
      ['a', 'a-s1', 1],
      ['a', 'a-s2', 2],
      ['a', 'a2', 3],
      ['a', 'a-s4', 4],
      ['b', 'b-s1', 5],
      ['c', 'c-s1', 6],
    ]);
  });

  it('znajduje sekcję po id', () => {
    expect(findSection(doc, 'a2')).toMatchObject({ chapterId: 'a' });
    expect(findSection(doc, 'nie-ma')).toBeUndefined();
  });
});

describe('activeTocEntry', () => {
  it('wyróżnia sekcję z tytułem, a dla sekcji bez tytułu najbliższą wcześniejszą', () => {
    expect(activeTocEntry(doc, 'a2')).toEqual({ chapterId: 'a', sectionId: 'a2' });
    expect(activeTocEntry(doc, 'a-s4')).toEqual({ chapterId: 'a', sectionId: 'a2' });
  });

  it('wyróżnia rozdział, gdy przed sekcją nie było żadnej z tytułem', () => {
    expect(activeTocEntry(doc, 'a-s2')).toEqual({ chapterId: 'a', sectionId: null });
  });

  it('zwraca null dla nieznanej sekcji', () => {
    expect(activeTocEntry(doc, 'x')).toBeNull();
    expect(activeTocEntry(doc, null)).toBeNull();
  });
});

describe('createReaderStore', () => {
  it('zaczyna od pierwszej sekcji albo od wskazanej', () => {
    expect(createReaderStore(doc).getState()).toEqual({
      chapterId: 'wstęp',
      sectionId: 'wstęp-s1',
    });
    expect(createReaderStore(doc, 'b-s1').getState().chapterId).toBe('b');
    expect(createReaderStore(doc, 'nie-ma').getState().sectionId).toBe('wstęp-s1');
  });

  it('nawiguje do sekcji i powiadamia subskrybentów', () => {
    const store = createReaderStore(doc);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(store.navigateTo('a2')).toBe(true);
    expect(listener).toHaveBeenCalledWith({ chapterId: 'a', sectionId: 'a2' });

    unsubscribe();
    store.navigateTo('b-s1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('powiadamia także przy ponownym przejściu do tej samej sekcji', () => {
    const store = createReaderStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);
    store.navigateTo('wstęp-s1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('odrzuca nieznaną sekcję bez zmiany stanu', () => {
    const store = createReaderStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.navigateTo('nie-ma')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('porusza się po sekcjach i nie wychodzi poza zakres', () => {
    const store = createReaderStore(doc);
    expect(store.previous()).toBe(false);
    expect(store.next()).toBe(true);
    expect(store.getState().sectionId).toBe('a-s1');
    store.navigateTo('c-s1');
    expect(store.next()).toBe(false);
    expect(store.getState().sectionId).toBe('c-s1');
  });

  it('porusza się po rozdziałach', () => {
    const store = createReaderStore(doc, 'a2');
    expect(store.nextChapter()).toBe(true);
    expect(store.getState().sectionId).toBe('b-s1');
    expect(store.previousChapter()).toBe(true);
    expect(store.getState().sectionId).toBe('a-s1');
    expect(store.previousChapter()).toBe(true);
    expect(store.getState().chapterId).toBe('wstęp');
    expect(store.previousChapter()).toBe(false);
  });

  it('obsługuje dokument bez rozdziałów', () => {
    const store = createReaderStore(parseScript('').document);
    expect(store.getState()).toEqual({ chapterId: null, sectionId: null });
    expect(store.next()).toBe(false);
    expect(store.nextChapter()).toBe(false);
    expect(store.navigateTo('x')).toBe(false);
  });
});

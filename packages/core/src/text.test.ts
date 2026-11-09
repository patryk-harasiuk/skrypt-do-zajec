import { describe, expect, it } from 'vitest';
import { parseInfoString, splitExplicitId } from './text.ts';

describe('splitExplicitId', () => {
  it('wydziela id z końca tytułu', () => {
    expect(splitExplicitId('Pętle {#petle}')).toEqual({ title: 'Pętle', id: 'petle' });
  });

  it('ignoruje klamry w środku tytułu', () => {
    expect(splitExplicitId('Zbiory {1, 2} i więcej')).toEqual({
      title: 'Zbiory {1, 2} i więcej',
      id: null,
    });
  });
});

describe('parseInfoString', () => {
  it('rozdziela język i atrybuty', () => {
    expect(parseInfoString('Quiz id=petle-1 x="a b" y=\'c\'')).toEqual({
      lang: 'quiz',
      attrs: { id: 'petle-1', x: 'a b', y: 'c' },
    });
  });

  it('obsługuje brak języka', () => {
    expect(parseInfoString(undefined)).toEqual({ lang: '', attrs: {} });
  });
});

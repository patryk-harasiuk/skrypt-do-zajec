import { describe, expect, it } from 'vitest';
import { pickActiveIndex, readingLineY } from './reading-line.ts';

describe('readingLineY', () => {
  it('leży na 25% wysokości obszaru', () => {
    expect(readingLineY(0, 800)).toBe(200);
    expect(readingLineY(64, 864)).toBe(264);
  });
});

describe('pickActiveIndex', () => {
  const tops = [-900, -100, 150, 500, 900];

  it('wybiera ostatnią sekcję, której początek jest nad linią', () => {
    expect(pickActiveIndex(tops, 200, false)).toBe(2);
    expect(pickActiveIndex(tops, 150, false)).toBe(2);
    expect(pickActiveIndex(tops, 149, false)).toBe(1);
  });

  it('przed pierwszą sekcją wybiera pierwszą', () => {
    expect(pickActiveIndex([300, 700], 200, false)).toBe(0);
  });

  it('na końcu strony wybiera ostatnią', () => {
    expect(pickActiveIndex(tops, 200, true)).toBe(4);
  });

  it('zwraca -1 dla pustej listy', () => {
    expect(pickActiveIndex([], 200, false)).toBe(-1);
    expect(pickActiveIndex([], 200, true)).toBe(-1);
  });
});

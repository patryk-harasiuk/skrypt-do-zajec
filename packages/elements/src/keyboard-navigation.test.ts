import { describe, expect, it } from 'vitest';
import { interpretKey, type KeyEventLike } from './keyboard-navigation.ts';

const key = (name: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: name,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  defaultPrevented: false,
  isComposing: false,
  ...extra,
});

describe('interpretKey', () => {
  it('→ i ← przechodzą między sekcjami', () => {
    expect(interpretKey(key('ArrowRight'))).toEqual({ kind: 'section', direction: 1 });
    expect(interpretKey(key('ArrowLeft'))).toEqual({ kind: 'section', direction: -1 });
  });

  it('Shift + strzałka przechodzi między rozdziałami', () => {
    expect(interpretKey(key('ArrowRight', { shiftKey: true }))).toEqual({
      kind: 'chapter',
      direction: 1,
    });
    expect(interpretKey(key('ArrowLeft', { shiftKey: true }))).toEqual({
      kind: 'chapter',
      direction: -1,
    });
  });

  it('↑ ↓ PgUp PgDn spacja Home End zostają zwykłym przewijaniem', () => {
    for (const name of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End']) {
      expect(interpretKey(key(name))).toBeNull();
    }
  });

  it('pomija skróty przeglądarki z Ctrl, Alt i Meta (np. Alt + ← to „wstecz”)', () => {
    expect(interpretKey(key('ArrowLeft', { altKey: true }))).toBeNull();
    expect(interpretKey(key('ArrowRight', { ctrlKey: true }))).toBeNull();
    expect(interpretKey(key('ArrowRight', { metaKey: true }))).toBeNull();
  });

  it('pomija zdarzenia obsłużone, powtarzane i z edytora IME', () => {
    expect(interpretKey(key('ArrowRight', { defaultPrevented: true }))).toBeNull();
    expect(interpretKey(key('ArrowRight', { repeat: true }))).toBeNull();
    expect(interpretKey(key('ArrowRight', { isComposing: true }))).toBeNull();
  });

  it('nie przejmuje strzałek z pól tekstowych i innych kontrolek', () => {
    const closestMatches = { closest: () => ({}) };
    expect(interpretKey(key('ArrowRight'), closestMatches)).toBeNull();
    expect(interpretKey(key('ArrowRight'), { isContentEditable: true })).toBeNull();
    expect(interpretKey(key('ArrowRight'), { closest: () => null })).toEqual({
      kind: 'section',
      direction: 1,
    });
  });
});

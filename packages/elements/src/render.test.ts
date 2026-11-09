// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render.ts';
import { readFixture } from './test-utils.ts';

function toDom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('renderMarkdown', () => {
  it('usuwa skrypty, atrybuty zdarzeń i linki javascript: (fixture xss.md)', () => {
    const source = readFixture('xss.md');
    const html = renderMarkdown(source);
    const root = toDom(html);

    expect(root.querySelector('script')).toBeNull();
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('linki zewnętrzne otwiera w nowej karcie z noopener', () => {
    const link = toDom(renderMarkdown('[pl](https://example.pl)')).querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('linki wewnętrzne zostają bez target', () => {
    const link = toDom(renderMarkdown('[tu](#sekcja)')).querySelector('a');
    expect(link?.getAttribute('href')).toBe('#sekcja');
    expect(link?.hasAttribute('target')).toBe(false);
  });

  it('nie pozwala ustawić własnego target w surowym HTML', () => {
    const link = toDom(renderMarkdown('<a href="/x" target="_blank">x</a>')).querySelector('a');
    expect(link?.hasAttribute('target')).toBe(false);
  });

  it('rozwiązuje linki referencyjne z definicji dokumentu', () => {
    const html = renderMarkdown('Zobacz [dokumentację][py].', '[py]: https://docs.python.org/3/');
    expect(toDom(html).querySelector('a')?.getAttribute('href')).toBe('https://docs.python.org/3/');
  });

  it('renderuje kod, tabele i listy zadań', () => {
    const html = renderMarkdown(
      '```python\nprint(1)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] gotowe\n',
    );
    const root = toDom(html);
    expect(root.querySelector('pre code')?.textContent).toContain('print(1)');
    expect(root.querySelectorAll('td')).toHaveLength(2);
    expect(root.querySelector('input[type="checkbox"]')).not.toBeNull();
  });
});

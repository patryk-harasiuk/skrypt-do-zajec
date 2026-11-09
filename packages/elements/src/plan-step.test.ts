import { describe, expect, it } from 'vitest';
import { anchorY, planStep, type StepGeometry } from './plan-step.ts';

// Okno 800 px, bez pasków: obszar czytania 0..800, linia lądowania 120.
const view = { visibleTop: 0, visibleBottom: 800 };
const geometry = (sectionTop: number, sectionBottom: number): StepGeometry => ({
  ...view,
  sectionTop,
  sectionBottom,
});

describe('anchorY', () => {
  it('to 15% wysokości obszaru, ale nie mniej niż 24 px od góry', () => {
    expect(anchorY(0, 800)).toBe(120);
    expect(anchorY(60, 860)).toBe(180);
    expect(anchorY(0, 100)).toBe(24);
  });
});

describe('planStep →', () => {
  it('przechodzi do następnej sekcji, gdy koniec bieżącej jest widoczny', () => {
    expect(planStep(geometry(120, 600), 1)).toEqual({ kind: 'go-to-adjacent' });
  });

  it('przechodzi dalej, gdy koniec sekcji mieści się z zapasem na krawędzi', () => {
    expect(planStep(geometry(120, 784), 1)).toEqual({ kind: 'go-to-adjacent' });
  });

  it('w długiej sekcji przewija o 85% wysokości obszaru', () => {
    expect(planStep(geometry(120, 3000), 1)).toEqual({ kind: 'scroll-within', delta: 680 });
  });

  it('nie przewija dalej niż do końca sekcji', () => {
    // Koniec sekcji 100 px pod krawędzią: dolna krawędź trafia na koniec sekcji z zapasem.
    expect(planStep(geometry(0, 900), 1)).toEqual({ kind: 'scroll-within', delta: 116 });
  });

  it('po przewinięciu do końca długiej sekcji kolejny krok idzie do następnej', () => {
    const afterScroll = geometry(-2200, 784);
    expect(planStep(afterScroll, 1)).toEqual({ kind: 'go-to-adjacent' });
  });

  it('ignoruje różnice w granicach tolerancji', () => {
    expect(planStep(geometry(120, 800 - 16 + 5), 1)).toEqual({ kind: 'go-to-adjacent' });
  });
});

describe('planStep ←', () => {
  it('przechodzi do poprzedniej sekcji, gdy początek bieżącej jest na linii lądowania', () => {
    expect(planStep(geometry(120, 2000), -1)).toEqual({ kind: 'go-to-adjacent' });
  });

  it('przechodzi do poprzedniej, gdy początek sekcji jest niżej niż linia lądowania', () => {
    expect(planStep(geometry(400, 900), -1)).toEqual({ kind: 'go-to-adjacent' });
  });

  it('najpierw wraca do początku bieżącej sekcji', () => {
    // Początek 300 px nad linią lądowania: wracamy dokładnie o tyle.
    expect(planStep(geometry(-180, 2000), -1)).toEqual({ kind: 'scroll-within', delta: -300 });
  });

  it('w bardzo długiej sekcji cofa o 85% wysokości obszaru', () => {
    expect(planStep(geometry(-3000, 500), -1)).toEqual({ kind: 'scroll-within', delta: -680 });
  });
});

describe('przyklejone paski', () => {
  it('liczy względem widocznego obszaru, a nie okna', () => {
    // Pasek u góry (64 px) i u dołu (72 px): obszar 64..728.
    const g: StepGeometry = {
      visibleTop: 64,
      visibleBottom: 728,
      sectionTop: 100,
      sectionBottom: 2000,
    };
    const plan = planStep(g, 1);
    expect(plan).toEqual({ kind: 'scroll-within', delta: Math.round(0.85 * 664 * 100) / 100 });
  });
});

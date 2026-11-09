import { parseScript } from '@skrypt/core';
import pythonPodstawy from '../../../fixtures/python-podstawy.md?raw';
import bledyAutora from '../../../fixtures/bledy-autora.md?raw';
import xss from '../../../fixtures/xss.md?raw';

/**
 * Tymczasowy podgląd kroku 2: pokazuje wynik parsera (model, spis treści, uwagi).
 * Czytnik (Lit) powstaje w kroku 3.
 */
const fixtures: Record<string, string> = {
  'python-podstawy.md': pythonPodstawy,
  'bledy-autora.md': bledyAutora,
  'xss.md': xss,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Brak elementu #app');

const select = document.createElement('select');
for (const name of Object.keys(fixtures)) select.add(new Option(name, name));

const output = document.createElement('pre');
output.style.whiteSpace = 'pre-wrap';

function render(): void {
  const { document: doc, diagnostics } = parseScript(fixtures[select.value] ?? '');
  output.textContent = JSON.stringify({ toc: doc.toc, diagnostics, document: doc }, null, 2);
}

select.addEventListener('change', render);
app.append(select, output);
render();

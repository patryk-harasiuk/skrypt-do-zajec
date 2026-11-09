import '@skrypt/elements';
import type { SkryptReader } from '@skrypt/elements';
import pythonPodstawy from '../../../fixtures/python-podstawy.md?raw';
import bledyAutora from '../../../fixtures/bledy-autora.md?raw';
import dlugaSekcja from '../../../fixtures/dluga-sekcja.md?raw';
import xss from '../../../fixtures/xss.md?raw';

/** Playground: wybór przykładowego skryptu i podgląd w czytniku. */
const fixtures: Record<string, string> = {
  'python-podstawy.md': pythonPodstawy,
  'bledy-autora.md': bledyAutora,
  'dluga-sekcja.md': dlugaSekcja,
  'xss.md': xss,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Brak elementu #app');

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
const label = document.createElement('label');
label.textContent = 'Skrypt: ';
const select = document.createElement('select');
for (const name of Object.keys(fixtures)) select.add(new Option(name, name));
label.append(select);
const diagnosticsOutput = document.createElement('output');
toolbar.append(label, diagnosticsOutput);

const reader = document.createElement('skrypt-reader') as SkryptReader;
reader.addEventListener('skrypt-diagnostics', (event) => {
  const count = (event as CustomEvent<unknown[]>).detail.length;
  diagnosticsOutput.textContent = `Uwagi dla autora: ${count} (szczegóły w konsoli)`;
  console.warn('[skrypt] diagnostyka', (event as CustomEvent).detail);
});

function load(): void {
  diagnosticsOutput.textContent = '';
  reader.markdown = fixtures[select.value] ?? '';
  // Fokus w czytniku, żeby od razu działały strzałki.
  void reader.updateComplete.then(() => reader.focusReader());
}

select.addEventListener('change', load);
app.append(toolbar, reader);
load();

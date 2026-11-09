import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wczytuje plik z `fixtures/` (działa także w środowisku jsdom, gdzie `URL` jest inny). */
export function readFixture(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '../../../fixtures', name), 'utf8');
}

// Prüfskript für die Wortpakete (SPEC.md Abschnitt 8.3).
// E0: Grundgerüst – die eigentlichen Prüfungen folgen in Etappe E2b.
import { readdirSync } from 'node:fs';

const dir = new URL('../data/words/', import.meta.url);
const packages = readdirSync(dir).filter((f) => /^words-\d{4}-\d{4}\.json$/.test(f));

if (packages.length === 0) {
  console.log('Keine Wortpakete in data/words/ – nichts zu prüfen.');
  process.exit(0);
}

console.error(`${packages.length} Wortpaket(e) gefunden, aber die Prüfungen sind noch nicht umgesetzt (E2b).`);
process.exit(1);

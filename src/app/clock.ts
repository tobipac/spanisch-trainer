// Zentrale Uhr der App. Im Entwicklungsmodus lässt sie sich zum Testen verstellen:
//   http://localhost:5173/?now=2026-10-02T10:00  → die App läuft ab diesem Zeitpunkt weiter.
// Im Produktions-Build gibt es keine Verstellung (dort am iPhone das Datum in den Einstellungen ändern).

let offsetMs = 0;

if (import.meta.env.DEV && typeof location !== 'undefined') {
  const param = new URLSearchParams(location.search).get('now');
  const target = param ? Date.parse(param) : NaN;
  if (!Number.isNaN(target)) offsetMs = target - Date.now();
}

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

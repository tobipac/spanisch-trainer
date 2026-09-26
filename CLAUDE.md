# CLAUDE.md – Spanisch-Vokabeltrainer (PWA)
_Version 2 · 260924_

## Projekt
Persönlicher Vokabeltrainer für Spanisch (Spanien, es-ES) als Progressive Web App.
- Ein einziger Nutzer, Gerät: iPhone (Safari, installiert über „Zum Home-Bildschirm“).
- Lernmethode: Spaced Repetition mit FSRS, aktives Abrufen, Beispielsätze, Audio.
- Inhalt: die 1.500 häufigsten spanischen Wörter (Lemmata), in Paketen zu je 300.
- Vollständige Anforderungen: **SPEC.md**. Bei Widerspruch gilt SPEC.md.

## Stack (keine weiteren Abhängigkeiten ohne Rückfrage)
- Vite + React + TypeScript (`strict: true`)
- Tailwind CSS
- ts-fsrs (Algorithmus – nicht selbst implementieren)
- Dexie (IndexedDB)
- vite-plugin-pwa (Manifest, Service Worker)
- Framer Motion (Animationen)
- Vitest (Tests)
- Nur für Build-Skripte der Wortliste (nicht zur Laufzeit): Python 3 + spaCy mit Modell `es_core_news_md`

Hosting: privates GitHub-Repo → Vercel (automatischer Deploy bei Push auf `main`).
Kein Backend, keine Accounts, keine externen Netzwerkaufrufe zur Laufzeit. Alle Lerndaten bleiben lokal am Gerät.

## Befehle
```
npm run dev              # lokaler Dev-Server
npm run build            # Produktions-Build nach dist/
npm run preview          # Build lokal testen
npm run test             # Vitest
npm run validate:words   # Prüfskript für die Wortliste
```

## Ordnerstruktur
```
src/
  app/            # App-Shell, Routing, Provider
  screens/        # Heute, Lernen, Fortschritt, Einstellungen, Onboarding
  components/     # UI-Bausteine (Karte, Buttons, Tagesring …)
  domain/         # Lernlogik: scheduler.ts, session.ts, gamification.ts
  db/             # Dexie-Schema, Migrationen, Backup (Export/Import)
  audio/          # Sprachausgabe (speechSynthesis)
  config/         # Konstanten: Limits, Bänder, Abdeckungstabelle
data/source/      # heruntergeladene Häufigkeitsliste + LICENSE/Quellenangabe
data/ranking/     # lemma-ranking.csv (erzeugt, versioniert)
data/words/       # words-0001-0300.json, words-0301-0600.json, …
scripts/          # build-ranking.py, validate-words.ts, sample-words.ts
public/icons/     # App-Icons
tests/
```

## Code-Regeln
- Mobile-first, Referenzbreite 375 px. Touch-Ziele mindestens 44 × 44 px. Safe-Area-Insets beachten.
- Lernlogik (`src/domain/`) ist reine Logik ohne UI-Abhängigkeit und vollständig mit Tests abgedeckt.
- Alle Zeitberechnungen in der lokalen Zeitzone. Der Lerntag wechselt um 04:00 Uhr, nicht um Mitternacht.
- Alle Konstanten (Limits, Schwellenwerte, FSRS-Parameter) nur in `src/config/`, nie im Code verstreut.
- Datenbankschema nur über versionierte Dexie-Migrationen ändern. Bestehende Lerndaten dürfen nie verloren gehen.
- UI-Texte auf Deutsch, Lerninhalte auf Spanisch/Deutsch.

## Regeln für die Wortliste
- Variante: Spanien (es-ES). Beispiele: *coche*, *móvil*, *ordenador*, *zumo*; *vosotros*-Formen erlaubt.
- **Rangfolge ausschließlich aus offenen Häufigkeitslisten**: FrequencyWords / OpenSubtitles (CC-BY-SA 4.0, gesprochen, 2/3) gemischt mit Leipzig Corpora Nachrichten + Wikipedia (CC-BY 4.0, geschrieben, 1/3), Details in SPEC.md Abschnitt 8. Quellenangabe in `data/source/` und in der App (Einstellungen → Quellen).
- Nicht aus urheberrechtlich geschützten Werken übernehmen, insbesondere nicht aus „A Frequency Dictionary of Spanish“ (Davies). Rang-Korrekturen, die der Nutzer aus eigenen Stichproben meldet, werden als einzelne Korrekturen übernommen und in `data/ranking/corrections.csv` protokolliert.
- **Keine PDF-, E-Book- oder Buchdateien im Projekt.** `.gitignore` enthält `*.pdf`, `*.epub`, `/reference/`. Taucht eine solche Datei im Arbeitsordner auf: nicht lesen, nicht committen, Nutzer informieren.
- Bestehende Einträge (`id`, `rank`) nie ohne Rückfrage ändern oder löschen, denn am Gerät hängt Lernfortschritt daran.
- Jedes Paket muss `npm run validate:words` fehlerfrei bestehen.

## Arbeitsweise
1. In den Etappen aus SPEC.md arbeiten, eine Etappe nach der anderen.
2. Vor jeder Etappe: kurzer Plan (Ziel, betroffene Dateien, Risiken).
3. Nach jeder Etappe: `build` + `test` grün, Commit mit Etappennummer, kurzer Bericht (was erledigt, was offen, wie am iPhone prüfen). Dann auf Abnahme warten.
4. Unklarheiten: gezielt nachfragen, nicht raten. Annahmen im Bericht kennzeichnen.
5. Nie destruktiv arbeiten: keine Force-Pushes, keine gelöschten Daten, keine überschriebenen Wortpakete.

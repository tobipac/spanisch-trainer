# SPEC.md – Spanisch-Vokabeltrainer V1
_Version 3 · 260926 · Änderungen gegenüber Version 2: Abschnitte 3, 4, 5, 7, 8 (Umkehrkarten-Warteschlange und -Limit, neutrale Tage, Joker-Regeln, „gefestigt“ = FSRS-`stability`, gestrichene Lemmata, Klarstellungen Prüfskript und Level, Umkehrkarten im Tagesziel, Anzeige „Umkehrkarten offen“, `dueAtStartIds`)_
_Version 2 · 260924 · Änderungen gegenüber Version 1: Abschnitte 3, 5, 7, 8, 11, 12 (Rangfolge und Abdeckung aus offener Häufigkeitsliste)_

## 1. Ziel
- 1.500 häufigste spanische Wörter (es-ES) in ca. 4–5 Monaten lernen.
- Aufwand: 15–20 Minuten pro Tag, 12 neue Wörter pro Tag (Standard).
- Die App soll Spaß machen, ohne das Lernprinzip zu untergraben. Belohnt wird regelmäßiges Wiederholen, nicht Pauken.

## 2. Rahmen
- Ein Nutzer, iPhone, installierte PWA, muss vollständig offline funktionieren.
- Keine Accounts, kein Server, keine Synchronisation.
- **Nicht in V1:** Push-Erinnerungen, Sync, Tippmodus, Grammatik, vorab aufgenommenes Audio, andere Sprachvarianten.

## 3. Datenmodell

```ts
// data/words/*.json  (statisch, mit der App ausgeliefert)
interface Word {
  id: string;          // "w0001" – stabil, nie ändern
  rank: number;        // Häufigkeitsrang 1..1500, lückenlos (aus data/ranking/lemma-ranking.csv)
  freqShare: number;   // Anteil dieses Lemmas an allen gezählten Wörtern der Quelle (0..1)
  es: string;          // Lemma, z. B. "casa"
  article?: "el" | "la" | "los" | "las"; // nur bei Nomen
  pos: "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "conj" | "det" | "num" | "interj" | "other";
  de: string;          // Hauptbedeutung
  deAlt?: string[];    // max. 2 weitere Bedeutungen
  exampleEs: string;   // Beispielsatz, max. 10 Wörter, Niveau A1–A2
  exampleDe: string;   // Übersetzung des Beispielsatzes
  note?: string;       // kurzer Hinweis (unregelmäßig, Doppelbedeutung …)
}

// IndexedDB (Dexie)
interface CardRecord {
  id: string;                        // `${wordId}:${direction}`
  wordId: string;
  direction: "es-de" | "de-es";
  fsrs: Card;                        // ts-fsrs Card-Objekt
  introducedAt: number | null;       // null = noch nie gezeigt
  queuedAt?: number;                 // nur "de-es": Zeitpunkt, an dem die Umkehrkarte in die Warteschlange kam (siehe 4.)
}
interface ReviewLogRecord { id?: number; cardId: string; rating: 1|2|3|4; reviewedAt: number; log: ReviewLog; }
interface DayRecord {
  day: string;            // YYYY-MM-DD, Lerntag ab 04:00
  newDone: number;        // eingeführte neue Wörter (Spanisch → Deutsch)
  reverseDone: number;    // eingeführte Umkehrkarten (Deutsch → Spanisch)
  reviewsDone: number;
  goalReached: boolean;
  neutral: boolean;       // Tag ohne Aufgaben (siehe 7. Streak)
  dueAtStartIds: string[]; // Karten, die beim ersten Öffnen des Lerntags fällig sind (fällig vor Lerntag-Ende); Basis für Tagesziel und Drosselung
  jokerUsed: boolean;
  xp: number;
}
interface Settings { newPerDay: number; autoPlayAudio: boolean; voiceURI?: string; speechRate: number; lastBackupAt?: number; onboardingDone: boolean; }
```

## 4. Lernlogik

**FSRS (ts-fsrs)**
- Parameter: `request_retention = 0.90`, `maximum_interval = 365`, `enable_fuzz = true`, `enable_short_term = true`.
- Lernschritte: 1 min, 10 min. Ist das in der installierten ts-fsrs-Version konfigurierbar, diese Werte setzen. Sonst das Standardverhalten verwenden und die Abweichung im Bericht melden.
- Standardgewichte von ts-fsrs verwenden. Keine eigene Optimierung in V1.

**Tagesablauf (Lerntag 04:00–04:00)**
- Neue Wörter pro Tag: Einstellung 5–20, Standard 12. Reihenfolge nach `rank`.
- Drosselung:
  - mehr als 100 fällige Wiederholungen → Limit für neue Wörter halbieren (abrunden)
  - mehr als 150 → 0 neue Wörter
  - Die App zeigt diesen Zustand kurz erklärt an.
- Reihenfolge in einer Session:
  1. fällige Karten in Lernschritten
  2. fällige Wiederholungen, die am längsten überfälligen zuerst
  3. neue Karten eingestreut: nach je 4 Wiederholungen 1 neue Karte
- **Umkehrkarte (Deutsch → Spanisch):**
  - Sobald die Spanisch → Deutsch-Karte nach einer Bewertung ein Intervall von 3 Tagen oder mehr hat, kommt ihre Umkehrkarte in eine **Warteschlange** (`CardRecord` mit `queuedAt`, `introducedAt = null`). Kein Wort geht verloren.
  - Eine Karte in der Warteschlange ist frühestens ab dem **nächsten Lerntag** verfügbar, nie in derselben Session oder am selben Lerntag.
  - **Tageslimit für Umkehrkarten = Einstellung „neue Wörter pro Tag“**, zusätzlich zum Limit für neue Wörter (bei Standard 12 also bis zu 12 neue Wörter + 12 Umkehrkarten).
  - Die Drosselung gilt auch für Umkehrkarten: mehr als 100 fällige Wiederholungen → Limit halbieren (abrunden), mehr als 150 → 0.
  - Reihenfolge aus der Warteschlange: zuerst die am längsten wartenden (`queuedAt`), bei Gleichstand nach `rank`. Nicht eingeführte Karten bleiben für die Folgetage in der Warteschlange.
  - Umkehrkarten werden wie neue Karten eingestreut (nach je 4 Wiederholungen 1 neue Karte), zählen aber nicht zum Limit für neue Wörter.
- **Rückgängig:** die letzte Bewertung einer Session zurücknehmen (Karte, Log und Tageszähler wiederherstellen).

**Tagesziel erreicht**, wenn:
- alle zu Tagesbeginn fälligen Karten bewertet sind, und
- das (ggf. gedrosselte) Limit für neue Wörter erfüllt ist.
- Umkehrkarten: Nur die **erste Einführung** einer Umkehrkarte aus der Warteschlange ist optional und zählt nicht zum Tagesziel. Bereits eingeführte Umkehrkarten zählen, sobald sie fällig sind, wie jede andere fällige Karte zum Tagesziel (und zur Drosselung).

## 5. Screens

**Onboarding (einmalig)**
- 3 kurze Seiten: Methode, Tagesablauf, Installation.
- Wird die App im Safari-Browser statt als installierte App geöffnet: dauerhafter Hinweis mit Anleitung (Teilen → „Zum Home-Bildschirm“).

**Heute (Startseite)**
- Tagesring: Fortschritt Richtung Tagesziel.
- Zahlen: fällig heute, neu heute, geschätzte Minuten (8 Sekunden pro Karte, im Code als Annahme dokumentiert).
- „Umkehrkarten offen: X“ (Anzahl Karten in der Warteschlange). Ist die Warteschlange größer als das Doppelte des Tageslimits für Umkehrkarten (Einstellung „neue Wörter pro Tag“, ohne Drosselung), erscheint ein dezenter Hinweis.
- Streak mit Joker-Anzeige.
- Großer Button „Lernen starten“.
- Backup-Hinweis, wenn das letzte Backup mehr als 7 Tage zurückliegt.

**Lernen**
- Vorderseite:
  - Spanisch → Deutsch: spanisches Wort mit Artikel und Audio-Button
  - Deutsch → Spanisch: deutsches Wort
- Aufdecken per Tap auf die Karte, mit Umdreh-Animation.
- Rückseite: Lösung, Artikel, Wortart, Beispielsatz Spanisch + Deutsch (Satz antippen spielt Audio), Hinweis.
- 4 Buttons „Nochmal / Schwer / Gut / Leicht“, jeweils mit dem nächsten Intervall als Vorschau aus ts-fsrs.
- Wischgesten: links = Nochmal, rechts = Gut. Die Buttons bleiben immer verfügbar.
- Fortschrittsbalken der Session, Button „Rückgängig“, Session jederzeit abbrechbar (Fortschritt bleibt gespeichert).
- Session-Ende: Zusammenfassung mit Karten, XP, Streak und kleiner Animation.

**Fortschritt**
- Bänder: 1–100, 101–250, 251–500, 501–1.000, 1.001–1.500. Je Band:
  - Anzahl gesehen
  - Anzahl gefestigt (FSRS-`stability` der Spanisch → Deutsch-Karte von 21 Tagen oder mehr; nicht das geplante Intervall)
  - Fortschrittsbalken
  - Abzeichen bei 90 % gefestigt
- Abdeckungsanzeige: „Du kennst ca. X % der Wörter in gesprochenem Spanisch“ (Berechnung siehe Abschnitt 7).
- Verlauf der letzten 30 Tage: Wiederholungen pro Tag als einfaches Balkendiagramm.
- Vorschau: fällige Karten in den nächsten 7 Tagen.

**Einstellungen**
- neue Wörter pro Tag
- Stimme wählen und Probe abspielen
- Sprechtempo (0,7–1,1, Standard 0,9)
- Audio automatisch abspielen an/aus
- Backup exportieren und importieren
- App-Version, Datenbank-Info (Anzahl Karten, Speicherstatus)
- Quellen: Häufigkeitsliste FrequencyWords (Hermit Dave, auf Basis OpenSubtitles), Lizenz CC-BY-SA 4.0, mit Link

## 6. Audio (V1: Stimme des Handys)
- `speechSynthesis`, Stimmenwahl nach Priorität:
  1. gespeicherte Stimme aus den Einstellungen
  2. es-ES, keine „compact“-Variante
  3. es-ES
  4. es-MX
  5. es-*
- Stimmen erst nach dem Ereignis `voiceschanged` auslesen (iOS lädt sie verzögert).
- iOS gibt Audio erst nach einer Nutzerberührung frei: der Tap auf „Lernen starten“ entsperrt es.
- Fehlt eine spanische Stimme: Hinweis in den Einstellungen. Die App bleibt ohne Audio voll nutzbar.

## 7. Gamification
- **XP:**
  - +1 pro Wiederholung
  - +2 pro neu gelerntem Wort
  - +10 Bonus bei erreichtem Tagesziel
  - **keine** XP für zusätzliche neue Wörter über das Limit hinaus
- **Streak:**
  - zählt Tage mit erreichtem Tagesziel
  - **Neutraler Tag:** Sind zu Beginn des Lerntags keine Karten fällig und ist das (ggf. gedrosselte) Limit für neue Wörter 0, gilt der Tag als neutral (`neutral = true`). Er zählt nicht für den Streak, unterbricht ihn aber nicht. Kein Tagesziel-Bonus, kein Joker-Verbrauch. Freiwillig bewertete Karten (z. B. Umkehrkarten) bringen die normalen XP pro Bewertung.
  - 1 Joker pro Kalenderwoche wird automatisch für einen verpassten Tag eingesetzt
  - Kalenderwoche = Montag bis Sonntag nach Lerntagen, also von Montag 04:00 bis Montag 04:00.
  - Ein ungenutzter Joker verfällt am Ende der Woche; Joker sammeln sich nicht an.
  - Mehrere verpasste Tage in einer Woche: der Joker rettet den ersten, der zweite verpasste Tag setzt den Streak auf 0.
  - Bei Streak 0 wird kein Joker verbraucht und keiner als eingesetzt angezeigt.
  - wird ein Joker eingesetzt, zeigt die App das an
- **Level:** aus der XP-Summe: Level n ab 50 · n² XP (Level 1 ab 50, Level 2 ab 200, Level 3 ab 450 …); unter 50 XP Level 0. Die Formel liegt in `config/`.
- **Abdeckung:** Summe von `freqShare` aller gefestigten Wörter (FSRS-`stability` der Spanisch → Deutsch-Karte von 21 Tagen oder mehr).
  - Anzeige gerundet auf ganze Prozent, immer mit „ca.“.
  - Zusätzlich die maximal erreichbare Abdeckung aller 1.500 Wörter als Zielmarke.
  - „ca.“ bleibt Pflicht, denn die Werte stammen aus Filmuntertiteln und das Zusammenführen auf Grundformen ist nicht fehlerfrei.

- **Animationen:** Kartenwechsel, Tagesring, Abzeichen. Dezent und schnell (unter 300 ms), keine blockierenden Effekte.

## 8. Wortliste

### 8.1 Rangliste (`scripts/build-ranking.py`, einmalig vor Paket 1)
1. **Quelle:** Repo `hermitdave/FrequencyWords` auf GitHub, spanische Liste `es_50k.txt` (Wortform + Anzahl), neueste Ausgabe. Den genauen Pfad im Repo prüfen.
   - Ablage in `data/source/` samt Lizenztext und Quellenangabe.
2. **Bereinigen:** Tokens mit Ziffern oder Sonderzeichen entfernen, ebenso Einzelbuchstaben (außer *a*, *y*, *o*, *e*, *u*), Wörter ohne spanische Wortform (z. B. englische Tokens), Eigennamen und Interjektionen/Füllwörter (*eh*, *ah*, *oh*, *ok*).
3. **Auf Grundformen zusammenführen:** spaCy `es_core_news_md`, jede Wortform → Lemma + Wortart.
   - Zählwerte je Lemma summieren; die 3 häufigsten Wortformen je Lemma mitspeichern.
   - Mehrdeutige Formen (z. B. *fue* → *ser*/*ir*, *sé* → *saber*/*ser*, *vino* → *venir*/*vino*): Zählwert nach Plausibilität aufteilen oder dem häufigeren Lemma zuordnen.
   - Alle solchen Fälle mit `ambiguous=true` markieren.
4. **Ergebnis:** `data/ranking/lemma-ranking.csv` mit den Spalten `rank, lemma, pos, count, freqShare, topForms, ambiguous, excluded`, mindestens 2.000 Zeilen als Puffer für Filterungen.
   - `freqShare` = Zählwert des Lemmas / Summe aller Zählwerte nach Bereinigung.
   - **Vom Nutzer gestrichene Lemmata** (z. B. filmtypische Wörter) bleiben mit `excluded=true` und leerem `rank` in der CSV und werden in `corrections.csv` protokolliert.
     - Sie bleiben im Nenner von `freqShare`; die Anteile aller anderen Lemmata ändern sich nicht. Die maximal erreichbare Abdeckung sinkt entsprechend.
     - Die Ränge der übrigen Lemmata werden lückenlos neu vergeben. Das ist nur für noch nicht veröffentlichte Pakete zulässig (siehe 8.2); gestrichen wird daher vor der Freigabe eines Pakets.
5. **Plausibilitätsprüfung durch Claude Code:**
   - Top 1.500 durchsehen; auffällig filmtypische Wörter markieren (z. B. *señor*, Schimpfwörter, *disparar*).
   - Bei solchen Wörtern entscheidet der Nutzer, ob sie bleiben.
   - Lemmatisierungsfehler korrigieren und in `data/ranking/corrections.csv` protokollieren (`lemma, alt, neu, grund`).

### 8.2 Rang-Korrekturen durch den Nutzer
- Der Nutzer vergleicht Stichproben mit eigenen Nachschlagewerken und meldet einzelne Ausreißer.
- Claude Code übernimmt die Meldung als Einzelkorrektur und protokolliert sie in `corrections.csv` mit dem Grund „Nutzerhinweis“.
- Bereits veröffentlichte Pakete: `id` bleibt unverändert. `rank` nur nach Rückfrage ändern, weil sich sonst Bänder und Fortschrittsanzeige verschieben.

### 8.3 Wortpakete
- Erstellung in 5 Paketen zu je 300 Einträgen nach `lemma-ranking.csv`. Dateien: `data/words/words-0001-0300.json` usw.
- `freqShare` wird aus der Rangliste übernommen.
- Pro Lemma ein Eintrag; weitere wichtige Bedeutungen kommen in `deAlt` oder `note`.
- Beispielsätze:
  - natürlich, Spanien-Spanisch, max. 10 Wörter
  - möglichst nur Wörter mit gleichem oder niedrigerem Rang
  - keine sensiblen Themen
- **`scripts/validate-words.ts`** (ein einziges Skript für alle Prüfungen):
  - **Fehler:** Pflichtfelder, `id` und `rank` eindeutig und lückenlos, `article` nur bei Nomen, Satzlänge über 10 Wörter.
  - **Fehler:** `rank` und `freqShare` stimmen nicht mit `lemma-ranking.csv` überein, oder `freqShare` steigt mit steigendem Rang (Gleichstände sind erlaubt: `freqShare` darf nie größer werden).
  - **Warnung:** das Lemma bzw. dessen Wortstamm kommt im Beispielsatz nicht vor.
- **`scripts/sample-words.ts`** erzeugt je Paket eine Markdown-Tabelle:
  - 20 zufällige Einträge plus alle Einträge mit `ambiguous=true` (max. 15). `ambiguous` wird aus `lemma-ranking.csv` gelesen; das `Word`-Modell der App enthält dieses Feld nicht.
  - Spalten: Rang, Lemma, Deutsch, Beispielsatz, Beispielsatz Deutsch, sowie eine leere Spalte „Anmerkung Nutzer“ für die eigene Kontrolle.
  - Der Nutzer prüft die Stichprobe vor der Freigabe.

## 9. Backup
- Export: alle Karten, Logs, Tage und Einstellungen als eine JSON-Datei mit Schema-Version.
  - Dateiname `YYMMDD Spanisch-Trainer_Backup.json`.
  - Auf iOS über `navigator.share` mit der Datei, sonst als Download-Link.
- Import: Datei prüfen, Zusammenfassung anzeigen (Anzahl Karten, Datum), nach Bestätigung vollständig ersetzen.
- `navigator.storage.persist()` beim ersten Start anfordern und das Ergebnis in den Einstellungen anzeigen.

## 10. PWA und Design
- Manifest:
  - Name „Spanisch“ (Platzhalter), `display: standalone`
  - Icons 192 und 512 px plus `apple-touch-icon` 180 px
  - Meta-Tags `apple-mobile-web-app-capable` und `status-bar-style`
- Service Worker: alles vorab zwischenspeichern, inklusive Wortpakete.
  - Neue Version: Hinweis „Update verfügbar – neu laden“.
  - Kein automatisches Neuladen mitten in einer Session.
- Design:
  - minimalistisch, hoher Kontrast
  - Hell/Dunkel nach Systemeinstellung
  - eine Akzentfarbe, Systemschrift
  - kein Überscrollen der Seite, Safe-Area-Insets beachten

## 11. Etappen und Abnahme

Nach jeder Etappe: Build und Tests grün, Commit, Bericht, dann auf Abnahme warten.

| # | Inhalt | Abnahme (durch Nutzer am iPhone) |
|---|---|---|
| E0 | Projekt aufsetzen, Tailwind, PWA-Grundgerüst, GitHub-Repo, Vercel-Anleitung | App über Vercel-URL erreichbar, am Home-Bildschirm installierbar, startet im Flugmodus |
| E1 | Datenbank, Scheduler, Session-Logik und Lerntag in `domain/`, Tests | Testbericht: Drosselung, Umkehrkarten, 04:00-Grenze, Rückgängig abgedeckt |
| E2a | Rangliste nach 8.1: Download, Bereinigung, Grundformen, Plausibilitätsprüfung | Top 300 und markierte Fälle vom Nutzer gesichtet, Korrekturen eingearbeitet |
| E2b | Wortpaket 1 (Rang 1–300), Prüfskript, Stichprobe | Prüfskript fehlerfrei, Stichprobe vom Nutzer freigegeben |
| E3 | Lernen-Screen, Kartenanimation, Wischgesten, Audio | Session mit 20 Karten flüssig, Audio spielt, Rückgängig funktioniert |
| E4 | Heute-Screen, Tagesziel, Streak, Joker, XP | Werte stimmen nach 2 Lerntagen (Test mit manipuliertem Datum erlaubt) |
| E5 | Fortschritt-Screen, Bänder, Abzeichen, Abdeckung, Diagramme | Anzeigen plausibel, Abdeckung als „ca.“ |
| E6 | Einstellungen, Backup, Onboarding, Installationshinweis, Update-Hinweis | Export → App löschen → neu installieren → Import: Stand vollständig wiederhergestellt |
| E7 | Test am iPhone, Lighthouse-PWA-Prüfung, Fehlerbehebung | 7 Tage Nutzung ohne Fehler |
| E8+ | Wortpakete 2–5 (je 300) | je Paket: Prüfskript fehlerfrei + Stichprobe freigegeben |

**Vercel-Einrichtung (Nutzer, einmalig in E0):**
1. vercel.com → mit GitHub anmelden → „Add New Project“ → Repo importieren.
2. Framework „Vite“ wird erkannt → Deploy.
3. Danach löst jeder Push auf `main` automatisch einen Deploy aus.

## 12. Risiken
- **Lernstand geht verloren**, wenn iOS den Speicher löscht → installierte App, `storage.persist()`, Backup-Hinweis.
- **Stimmen sind auf iOS uneinheitlich verfügbar** → Rückfalllogik, App funktioniert auch ohne Audio.
- **Qualität der generierten Übersetzungen und Sätze** → Prüfskript und Stichprobe pro Paket.
- **Grundformen-Fehler** (mehrdeutige Formen wie *fue*, *sé*, *vino*) → `ambiguous`-Markierung, Korrekturprotokoll, Nutzer-Stichprobe.
- **Filmsprache in der Quelle** (Anrede, Befehle, Kraftausdrücke) → Plausibilitätsprüfung in 8.1, Entscheidung durch den Nutzer.
- **Lizenz CC-BY-SA:** Die Rangliste gilt als abgeleitete Datenbank → Quellenangabe in der App und in `data/source/`. Die abgeleiteten Ranglistendaten stehen ebenfalls unter CC-BY-SA.
- **Abdeckung bleibt ein Näherungswert** → Anzeige immer mit „ca.“.

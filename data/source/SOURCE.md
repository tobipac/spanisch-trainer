# Quelle der Häufigkeitsliste

- **Datei:** `es_50k.txt` (Wortform + Anzahl, 50.000 Zeilen)
- **Projekt:** FrequencyWords von Hermit Dave – https://github.com/hermitdave/FrequencyWords
- **Pfad im Repo:** `content/2018/es/es_50k.txt`
- **Stand:** Commit `525f9b560de45753a5ea01069454e72e9aa541c6` (heruntergeladen am 2026-09-26)
- **Datengrundlage:** OpenSubtitles 2018 (OPUS), http://opus.nlpl.eu/OpenSubtitles2018.php
- **Lizenz der Inhalte:** Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Der Code des Projekts steht unter MIT (`FrequencyWords-LICENSE.txt`); für die Wortliste gilt CC BY-SA 4.0 laut README des Projekts.

## Abgeleitete Daten

`data/ranking/lemma-ranking.csv` ist aus dieser Liste abgeleitet (Bereinigung, Zusammenführung auf Grundformen mit spaCy)
und steht daher ebenfalls unter **CC BY-SA 4.0**. Die Quellenangabe erscheint auch in der App (Einstellungen → Quellen).

## Hilfsliste Englisch

- **Datei:** `en_50k.txt` aus demselben Projekt und Commit (`content/2018/en/en_50k.txt`), gleiche Lizenz (CC BY-SA 4.0).
- Wird nur als Filter verwendet: Tokens, die im Englischen relativ mehr als dreimal so häufig sind wie im Spanischen,
  gelten als englisch und werden entfernt (Ausnahmen wie *he*, *come*, *once* stehen in `data/ranking/rules.csv`).

## Geschriebene Sprache: Leipzig Corpora Collection

- **Dateien:** `leipzig_news_2022_50k.txt`, `leipzig_wikipedia_2021_50k.txt` (je 50.000 häufigste Wortformen, kleingeschrieben)
- **Herkunft:** Leipzig Corpora Collection, Universität Leipzig – https://wortschatz.uni-leipzig.de/en/download/
  - `spa_news_2022_300K` (Nachrichten 2022, 300.000 Sätze, 7,6 Mio. Wörter)
  - `spa_wikipedia_2021_300K` (Wikipedia 2021, 300.000 Sätze)
  - heruntergeladen am 2026-09-26 von `downloads.wortschatz-leipzig.de/corpora/`
- **Lizenz:** Creative Commons Attribution 4.0 (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- **Zitiervorschlag:** D. Goldhahn, T. Eckart & U. Quasthoff: Building Large Monolingual Dictionaries at the Leipzig
  Corpora Collection: From 100 to 200 Languages. In: Proceedings of LREC 2012.
- **Bearbeitung** (`scripts/prepare-written.py`): nur die Wortliste (`*-words.txt`) verwendet, Groß-/Kleinschreibung
  zusammengeführt, Wörter mit weniger als 10 % Kleinschreibung als Eigennamen verworfen, auf 50.000 Einträge gekürzt.

## Mischung

Die Rangliste mischt gesprochene (FrequencyWords, Gewicht 2/3) und geschriebene Sprache (Leipzig, Gewicht 1/3),
siehe SPEC.md Abschnitt 8.1. Die gemischte, abgeleitete Rangliste steht unter CC BY-SA 4.0.

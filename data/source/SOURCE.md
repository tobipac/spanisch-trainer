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

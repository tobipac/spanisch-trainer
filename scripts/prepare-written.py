"""Bereitet die Leipzig-Korpora (geschriebene Sprache) für build-ranking.py vor (SPEC.md Abschnitt 8.1).

Eingabe: *-words.txt aus den Archiven der Leipzig Corpora Collection (id <TAB> Wort <TAB> Anzahl),
         z. B. spa_news_2022_300K-words.txt und spa_wikipedia_2021_300K-words.txt
Ausgabe: data/source/<name>_50k.txt im Format von es_50k.txt ("wort anzahl", kleingeschrieben)

- Groß-/Kleinschreibung wird zusammengeführt.
- Eigennamen: Wörter, die fast nie kleingeschrieben vorkommen (Madrid, García), werden verworfen.
  Das geht nur hier, weil die Untertitelliste bereits kleingeschrieben ist.

Aufruf: .venv/Scripts/python scripts/prepare-written.py <words.txt> <ausgabename>
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP = 50_000
MIN_LOWERCASE_SHARE = 0.10  # darunter gilt ein Wort als Eigenname


def main(src: Path, name: str) -> None:
    total: Counter[str] = Counter()
    lower: Counter[str] = Counter()
    with src.open(encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            word, count = parts[1], int(parts[2])
            key = word.lower()
            total[key] += count
            if word == key:
                lower[key] += count
    kept = [(w, c) for w, c in total.items() if lower[w] >= MIN_LOWERCASE_SHARE * c]
    kept.sort(key=lambda kv: -kv[1])
    out = ROOT / "data" / "source" / f"{name}_50k.txt"
    with out.open("w", encoding="utf-8", newline="\n") as f:
        for w, c in kept[:TOP]:
            f.write(f"{w} {c}\n")
    dropped = len(total) - len(kept)
    print(f"{out.name}: {min(TOP, len(kept))} Wörter geschrieben, {dropped} Eigennamen-Kandidaten verworfen")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(Path(sys.argv[1]), sys.argv[2])

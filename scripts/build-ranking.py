"""Erzeugt data/ranking/lemma-ranking.csv aus der FrequencyWords-Liste (SPEC.md Abschnitt 8.1).

Ablauf:
  1. es_50k.txt einlesen (Wortform + Anzahl)
  2. bereinigen: Ziffern/Sonderzeichen, Einzelbuchstaben, englische Tokens, Füllwörter, Regeln "remove"
  3. Wortform -> Lemma + Wortart: Regeln aus data/ranking/rules.csv, sonst spaCy (es_core_news_md),
     Verbformen mit angehängten Pronomen (dime, hazlo) werden zerlegt
  4. Zählwerte je Lemma summieren, freqShare = Zählwert / Summe aller Zählwerte nach Bereinigung
  5. Ausgabe: lemma-ranking.csv, corrections.csv (Protokoll), review.md (Prüfliste)

Aufruf:  .venv/Scripts/python scripts/build-ranking.py
Einrichtung: py -3.12 -m venv .venv
             .venv/Scripts/python -m pip install -r scripts/requirements.txt

Regeln (data/ranking/rules.csv, Spalten action,key,value,ambiguous,grund):
  remove   Wortform entfernen (Füllwort, Eigenname …)
  keep     Wortform nicht als Englisch filtern
  assign   Wortform -> "lemma:pos" oder aufgeteilt "lemma:pos:anteil|lemma:pos:anteil" (mehrdeutig)
  rename   Lemma -> "lemma:pos" (Grundform oder Wortart korrigieren)
  flag     Lemma zur Entscheidung durch den Nutzer markieren (filmtypisch, Kraftausdruck, lateinamerikanisch)
  exclude  Lemma vom Nutzer gestrichen: bleibt mit excluded=true und ohne Rang in der CSV
  checked  unsicheres Lemma geprüft und korrekt
  note     Notiz zum Lemma, wird in E2b als Word.note übernommen (z. B. lateinamerikanisch)
Jede angewandte Korrektur wird in data/ranking/corrections.csv protokolliert.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import spacy

from verb_forms import CLITIC_SUFFIXES, IRREGULAR_FORMS, IRREGULAR_STEMS, infinitive_candidates, strip_accents

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source" / "es_50k.txt"
SOURCE_EN = ROOT / "data" / "source" / "en_50k.txt"
RULES = ROOT / "data" / "ranking" / "rules.csv"
OUT_RANKING = ROOT / "data" / "ranking" / "lemma-ranking.csv"
OUT_CORRECTIONS = ROOT / "data" / "ranking" / "corrections.csv"
OUT_REVIEW = ROOT / "data" / "ranking" / "review.md"

OUTPUT_ROWS = 3000  # SPEC: mindestens 2.000 Zeilen als Puffer
REVIEW_TOP = 300
SINGLE_LETTERS_OK = {"a", "y", "o", "e", "u"}
TOKEN_RE = re.compile(r"^[a-záéíóúüñ]+$")

# Englisch-Filter: Token gilt als englisch, wenn es in der englischen Liste relativ viel häufiger ist
# als in der spanischen. Ausnahmen (echte spanische Wörter) stehen in rules.csv als "keep".
EN_RATIO = 3.0

POS_MAP = {
    "PROPN": "noun",  # spaCy hält isolierte Nomen oft für Eigennamen; echte Namen entfernt rules.csv
    "NOUN": "noun", "VERB": "verb", "AUX": "verb", "ADJ": "adj", "ADV": "adv", "PRON": "pron",
    "ADP": "prep", "CCONJ": "conj", "SCONJ": "conj", "DET": "det", "NUM": "num", "INTJ": "interj",
}

MIN_INFINITIVE_COUNT = 100  # Infinitiv muss in der Quelle mindestens so oft vorkommen
# Infinitive, die spaCy isoliert als Nomen einordnet
ALWAYS_INFINITIVES = {"poder", "deber", "ser", "haber", "saber", "parecer", "amanecer", "comer", "cenar"}
# von spaCy fälschlich als Verb erkannte Nomen, Adjektive, Namen und englische Wörter auf -ar/-er/-ir
NOT_INFINITIVES = set("""
par star omar zar her over bear car veer gear hear lear collar turner hunter alexander palmer tucker silver edgar
estándar tanner archer dexter billar summer luther kramer weaver avatar homer gallagher sugar pilar bender caviar
macgyver mártir auxiliar slater xander decker carver pulmonar hoover jaguar granger riker mercer gunnar sylvester
ragnar thatcher calamar conner pajar malestar póster salazar wilder custer doquier fraser paladar eisenhower gunther
lancaster hester elmer trailer porvenir burger glaciar brenner regular mar bar lugar hogar altar azar dólar mujer
ayer taller cáncer placer pesar
""".split())
# Abkürzungen mit Punkt werden der ausgeschriebenen Form zugerechnet statt verworfen
ABBREVIATIONS = {"sr.": "señor", "sra.": "señora", "srta.": "señorita", "ud.": "usted", "uds.": "ustedes", "dr.": "doctor", "dra.": "doctora"}


def is_infinitive(s: str) -> bool:
    return s.endswith(("ar", "er", "ir", "ír"))


@dataclass
class Rules:
    remove: dict[str, str] = field(default_factory=dict)  # form -> Grund
    keep: set[str] = field(default_factory=set)  # nicht als Englisch filtern
    assign: dict[str, tuple[list[tuple[str, str, float]], bool, str]] = field(default_factory=dict)
    rename: dict[str, tuple[str, str, str]] = field(default_factory=dict)  # lemma -> (neu, pos, Grund)
    flag: dict[str, str] = field(default_factory=dict)  # lemma -> Grund (filmtypisch …)
    exclude: dict[str, str] = field(default_factory=dict)  # lemma -> Grund (vom Nutzer gestrichen)
    checked: set[str] = field(default_factory=set)  # unsichere Lemmata, die geprüft und korrekt sind
    note: dict[str, str] = field(default_factory=dict)  # lemma -> Notiz fürs Wortpaket (Word.note)


def parse_targets(value: str) -> list[tuple[str, str, float]]:
    """"ser:verb:0.7|ir:verb:0.3" oder "dios:noun" -> [(lemma, pos, anteil)]"""
    parts = []
    for item in value.split("|"):
        bits = item.split(":")
        lemma, pos = bits[0], bits[1]
        share = float(bits[2]) if len(bits) > 2 else 1.0
        parts.append((lemma, pos, share))
    total = sum(p[2] for p in parts)
    if abs(total - 1.0) > 1e-6:
        raise ValueError(f"Anteile ergeben nicht 1: {value}")
    return parts


def load_rules() -> Rules:
    rules = Rules()
    with RULES.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            action, key, value, grund = row["action"], row["key"], row["value"], row["grund"]
            ambiguous = row.get("ambiguous", "").strip().lower() == "true"
            if action == "remove":
                rules.remove[key] = grund
            elif action == "keep":
                rules.keep.add(key)
            elif action == "assign":
                targets = parse_targets(value)
                rules.assign[key] = (targets, ambiguous or len(targets) > 1, grund)
            elif action == "rename":
                lemma, pos = value.split(":")
                rules.rename[key] = (lemma, pos, grund)
            elif action == "flag":
                rules.flag[key] = grund
            elif action == "note":
                rules.note[key] = value
            elif action == "checked":
                rules.checked.add(key)
            elif action == "exclude":
                rules.exclude[key] = grund
            else:
                raise ValueError(f"Unbekannte Aktion in rules.csv: {action}")
    return rules


def read_list(path: Path) -> list[tuple[str, int]]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) == 2:
                rows.append((parts[0].lower(), int(parts[1])))
    return rows


def main() -> None:
    rules = load_rules()
    es = read_list(SOURCE)
    en = read_list(SOURCE_EN)
    es_total_raw = sum(c for _, c in es)
    en_total = sum(c for _, c in en)
    en_rel = {w: c / en_total for w, c in en}

    # ---------- 2. Bereinigen ----------
    kept: list[tuple[str, int]] = []
    removed: list[tuple[str, int, str]] = []
    merged: Counter[str] = Counter()
    for form, count in es:
        merged[ABBREVIATIONS.get(form, form)] += count
    es_clean = sorted(merged.items(), key=lambda kv: -kv[1])
    for form, count in es_clean:
        reason = None
        if not TOKEN_RE.match(form):
            reason = "Ziffern/Sonderzeichen"
        elif len(form) == 1 and form not in SINGLE_LETTERS_OK:
            reason = "Einzelbuchstabe"
        elif form in rules.remove:
            reason = rules.remove[form]
        elif form not in rules.keep and form not in rules.assign and en_rel.get(form, 0) > EN_RATIO * count / es_total_raw:
            reason = "englisch"
        if reason:
            removed.append((form, count, reason))
        else:
            kept.append((form, count))
    total = sum(c for _, c in kept)

    # ---------- 3. Grundformen ----------
    nlp = spacy.load("es_core_news_md", disable=["parser", "ner"])
    forms = [f for f, _ in kept]
    analysed = {f: (d[0].lemma_.lower(), d[0].pos_) for f, d in zip(forms, nlp.pipe(forms, batch_size=2000))}

    known_forms = {f for f, _ in es}
    form_count = dict(es)
    # Infinitiv = von spaCy als Verb erkannt (schließt Nomen wie mar, par, lugar und Namen wie homer aus)
    known_infinitives = {
        f for f, c in kept
        if is_infinitive(f) and c >= MIN_INFINITIVE_COUNT and analysed[f][1] in ("VERB", "AUX")
    } - NOT_INFINITIVES | set(IRREGULAR_FORMS.values()) | set(IRREGULAR_STEMS.values()) | ALWAYS_INFINITIVES

    def clean_lemma(lemma: str) -> str:
        # "hacer él" (hacerlo) -> "hacer"
        return lemma.split(" ")[0]

    def verb_lemma(form: str, s_lemma: str) -> str | None:
        """Infinitiv für eine Verbform: spaCy, wenn plausibel, sonst Rückführung über Endungen."""
        if form in IRREGULAR_FORMS:
            return IRREGULAR_FORMS[form]
        cands = infinitive_candidates(form, known_infinitives)
        if s_lemma in known_infinitives and (not cands or s_lemma in cands):
            return s_lemma
        if cands:
            return max(cands, key=lambda c: form_count.get(c, 0))
        return s_lemma if s_lemma in known_infinitives else None

    lemma_counts: Counter[str] = Counter()
    lemma_forms: dict[str, Counter[str]] = defaultdict(Counter)
    lemma_pos: dict[str, Counter[str]] = defaultdict(Counter)
    forced_pos: dict[str, str] = {}
    ambiguous: set[str] = set()
    uncertain: dict[str, str] = {}  # Lemma kommt in der Quelle nicht vor -> prüfen
    corrections: list[dict[str, str]] = []

    for form, count in kept:
        s_lemma, s_pos = analysed[form]
        spacy_desc = f"{s_lemma}:{POS_MAP.get(s_pos, 'other')}"
        if form in rules.assign:
            targets, amb, grund = rules.assign[form]
            new_desc = "|".join(f"{l}:{p}" + (f":{s:g}" if len(targets) > 1 else "") for l, p, s in targets)
            if new_desc != spacy_desc:
                corrections.append({"lemma": form, "alt": spacy_desc, "neu": new_desc, "grund": grund})
            for l, p, _ in targets:
                forced_pos[l] = p
        else:
            lemma, pos = clean_lemma(s_lemma), POS_MAP.get(s_pos, "other")
            looks_like_verb_with_clitic = any(
                form.endswith(c) and (strip_accents(form) != form or strip_accents(form[: -len(c)]) in known_infinitives)
                for c in CLITIC_SUFFIXES
            )
            if form in IRREGULAR_FORMS:
                lemma, pos = IRREGULAR_FORMS[form], "verb"
            elif s_pos in ("VERB", "AUX") or looks_like_verb_with_clitic:
                inf = verb_lemma(form, lemma)
                if inf:
                    lemma, pos = inf, "verb"
                elif s_pos in ("VERB", "AUX") and lemma not in known_forms:
                    lemma, pos = form, "other"  # spaCy hat eine Kunstform erzeugt (z. B. señoritar)
            if lemma not in known_forms:
                uncertain[lemma] = form
                lemma = form if s_pos not in ("VERB", "AUX") else lemma
            targets, amb = [(lemma, pos, 1.0)], False
        for lemma, pos, share in targets:
            if lemma in rules.rename:
                new_lemma, new_pos, grund = rules.rename[lemma]
                corrections.append({"lemma": lemma, "alt": f"{lemma}:{pos}", "neu": f"{new_lemma}:{new_pos}", "grund": grund})
                lemma, pos = new_lemma, new_pos
                forced_pos[lemma] = pos
            lemma_counts[lemma] += count * share
            lemma_forms[lemma][form] += count * share
            lemma_pos[lemma][pos] += count * share
            if amb:
                ambiguous.add(lemma)

    def pos_of(lemma: str) -> str:
        return forced_pos.get(lemma) or lemma_pos[lemma].most_common(1)[0][0]

    ranking = sorted(lemma_counts.items(), key=lambda kv: (-kv[1], kv[0]))

    # ---------- 4. Ausgabe ----------
    OUT_RANKING.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    rank = 0
    for lemma, count in ranking:
        excluded = lemma in rules.exclude
        if not excluded:
            rank += 1
        rows.append({
            "rank": "" if excluded else rank,
            "lemma": lemma,
            "pos": pos_of(lemma),
            "count": round(count),
            "freqShare": f"{count / total:.8f}",
            "topForms": " ".join(f for f, _ in lemma_forms[lemma].most_common(3)),
            "ambiguous": "true" if lemma in ambiguous else "false",
            "excluded": "true" if excluded else "false",
        })
        if rank >= OUTPUT_ROWS and not excluded:
            break

    with OUT_RANKING.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    seen = set()
    unique_corr = []
    for c in corrections:
        k = (c["lemma"], c["neu"])
        if k not in seen:
            seen.add(k)
            unique_corr.append(c)
    for lemma, grund in rules.exclude.items():
        unique_corr.append({"lemma": lemma, "alt": "enthalten", "neu": "gestrichen", "grund": grund})
    with OUT_CORRECTIONS.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["lemma", "alt", "neu", "grund"], lineterminator="\n")
        w.writeheader()
        w.writerows(unique_corr)

    write_review(rows, rules, removed, total, es_total_raw, uncertain)

    ranked = [r for r in rows if r["rank"] != ""]
    cov = sum(float(r["freqShare"]) for r in ranked[:1500])
    print(f"Wortformen gelesen: {len(es)}, behalten: {len(kept)}, entfernt: {len(removed)}")
    print(f"Anteil der entfernten Tokens: {1 - total / es_total_raw:.2%}")
    print(f"Lemmata gesamt: {len(ranking)}, ausgegeben: {len(rows)}")
    print(f"Abdeckung Top 1.500 (Summe freqShare): {cov:.2%}")
    print(f"Korrekturen: {len(unique_corr)}, mehrdeutig markiert: {len(ambiguous)}")


def write_review(rows, rules: Rules, removed, total, es_total_raw, uncertain) -> None:
    ranked = [r for r in rows if r["rank"] != ""]
    lines = [
        "# Prüfliste Rangliste (E2a)",
        "",
        "Erzeugt von `scripts/build-ranking.py`. Bitte Top 300 und die markierten Fälle sichten.",
        "",
        f"- Abdeckung Top 1.500: ca. {sum(float(r['freqShare']) for r in ranked[:1500]):.1%} der gezählten Wörter",
        f"- Entfernte Tokens (Bereinigung): {1 - total / es_total_raw:.1%}",
        "",
        "## Zur Entscheidung: filmtypische Wörter in den Top 1.500",
        "",
        "Bitte je Wort entscheiden: **bleibt** oder **streichen**.",
        "",
        "| Rang | Lemma | Wortart | häufigste Formen | Grund |",
        "|---:|---|---|---|---|",
    ]
    for r in ranked[:1500]:
        if r["lemma"] in rules.flag:
            lines.append(f"| {r['rank']} | {r['lemma']} | {r['pos']} | {r['topForms']} | {rules.flag[r['lemma']]} |")
    lines += [
        "",
        "## Mehrdeutige Grundformen in den Top 1.500 (`ambiguous=true`)",
        "",
        "| Rang | Lemma | Wortart | häufigste Formen |",
        "|---:|---|---|---|",
    ]
    for r in ranked[:1500]:
        if r["ambiguous"] == "true":
            lines.append(f"| {r['rank']} | {r['lemma']} | {r['pos']} | {r['topForms']} |")
    lines += [
        "",
        "## Unsichere Grundformen in den Top 1.500 (Grundform kommt in der Quelle nicht vor)",
        "",
        "| Rang | Lemma | Wortart | häufigste Formen |",
        "|---:|---|---|---|",
    ]
    for r in ranked[:1500]:
        if r["lemma"] in uncertain and r["lemma"] not in rules.checked:
            lines.append(f"| {r['rank']} | {r['lemma']} | {r['pos']} | {r['topForms']} |")
    lines += [
        "",
        f"## Top {REVIEW_TOP}",
        "",
        "| Rang | Lemma | Wortart | Anteil | häufigste Formen | ⚑ |",
        "|---:|---|---|---:|---|---|",
    ]
    for r in ranked[:REVIEW_TOP]:
        mark = ("mehrdeutig " if r["ambiguous"] == "true" else "") + ("film" if r["lemma"] in rules.flag else "")
        lines.append(
            f"| {r['rank']} | {r['lemma']} | {r['pos']} | {float(r['freqShare']) * 100:.3f} % | {r['topForms']} | {mark.strip()} |"
        )
    lines += [
        "",
        "## Größte entfernte Tokens (zur Kontrolle der Bereinigung)",
        "",
        "| Token | Anzahl | Grund |",
        "|---|---:|---|",
    ]
    for form, count, reason in sorted(removed, key=lambda x: -x[1])[:80]:
        lines.append(f"| {form} | {count} | {reason} |")
    OUT_REVIEW.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

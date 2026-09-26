"""Rückführung spanischer Verbformen auf den Infinitiv (Hilfsmodul für build-ranking.py).

spaCy lemmatisiert einzelne Wortformen ohne Satzkontext unzuverlässig (z. B. crees, estabas, dijiste).
Dieses Modul erzeugt Infinitiv-Kandidaten aus Konjugationsendungen, Stammwechseln, Schreibanpassungen,
unregelmäßigen Stämmen und angehängten Pronomen. Ein Kandidat zählt nur, wenn er in der Menge
bekannter Infinitive (aus der Quelle) enthalten ist.
"""

from __future__ import annotations

import unicodedata

AR_ENDINGS = [
    "o", "as", "a", "amos", "áis", "an", "é", "aste", "ó", "asteis", "aron",
    "aba", "abas", "ábamos", "abais", "aban", "e", "es", "emos", "éis", "en",
    "ara", "aras", "áramos", "arais", "aran", "ase", "ases", "asen", "ando", "ado", "ada", "ados", "adas", "ad",
    "á", "ás", "án", "és", "én",  # estar, dar
]
ER_IR_ENDINGS = [
    "o", "es", "e", "emos", "éis", "imos", "ís", "en", "í", "iste", "ió", "isteis", "ieron",
    "ía", "ías", "íamos", "íais", "ían", "a", "as", "amos", "áis", "an",
    "iera", "ieras", "iéramos", "ierais", "ieran", "iese", "ieses", "iesen", "iendo", "ido", "ida", "idos", "idas",
    "ed", "id", "yendo", "yó", "yeron", "ído", "ída",
]
# Futur und Konditional hängen an den Infinitiv an
FUT_COND_ENDINGS = ["é", "ás", "á", "emos", "éis", "án", "ía", "ías", "íamos", "íais", "ían"]

# unregelmäßige Stämme -> Infinitiv (Endung wird wie oben abgetrennt)
IRREGULAR_STEMS = {
    "teng": "tener", "tien": "tener", "tuv": "tener", "tendr": "tener",
    "hag": "hacer", "hic": "hacer", "hiz": "hacer", "har": "hacer", "hech": "hacer",
    "dig": "decir", "dic": "decir", "dij": "decir", "dir": "decir", "dich": "decir",
    "pued": "poder", "pud": "poder", "podr": "poder",
    "pong": "poner", "pus": "poner", "pondr": "poner", "puest": "poner",
    "quier": "querer", "quis": "querer", "querr": "querer",
    "sep": "saber", "sup": "saber", "sabr": "saber",
    "veng": "venir", "vien": "venir", "vin": "venir", "vendr": "venir",
    "salg": "salir", "saldr": "salir",
    "traig": "traer", "traj": "traer",
    "caig": "caer",
    "oig": "oír", "oy": "oír",
    "valg": "valer", "valdr": "valer",
    "estuv": "estar",
    "anduv": "andar",
    "conduj": "conducir", "traduj": "traducir", "produj": "producir",
    "hab": "haber", "habr": "haber", "hay": "haber", "hub": "haber",
    "huel": "oler", "ve": "ver",
    "vay": "ir",
    "sea": "ser",
    "muert": "morir", "escrit": "escribir", "abiert": "abrir", "rot": "romper", "vuelt": "volver",
    "vist": "ver", "cubiert": "cubrir", "resuelt": "resolver", "devuelt": "devolver",
}

# vollständig unregelmäßige Formen
IRREGULAR_FORMS = {
    "soy": "ser", "eres": "ser", "es": "ser", "somos": "ser", "sois": "ser", "son": "ser",
    "era": "ser", "eras": "ser", "éramos": "ser", "erais": "ser", "eran": "ser",
    "sea": "ser", "seas": "ser", "seamos": "ser", "seáis": "ser", "sean": "ser", "sed": "ser", "siendo": "ser", "sido": "ser",
    "voy": "ir", "vas": "ir", "va": "ir", "vamos": "ir", "vais": "ir", "van": "ir",
    "iba": "ir", "ibas": "ir", "íbamos": "ir", "ibais": "ir", "iban": "ir", "id": "ir", "yendo": "ir", "ido": "ir",
    "estoy": "estar", "doy": "dar", "dio": "dar", "dimos": "dar", "disteis": "dar", "dieron": "dar", "diste": "dar",
    "dé": "dar", "des": "dar", "den": "dar",
    "veo": "ver", "vi": "ver", "vio": "ver", "viste": "ver", "vimos": "ver", "vieron": "ver", "veía": "ver", "veías": "ver",
    "he": "haber", "has": "haber", "ha": "haber", "hemos": "haber", "han": "haber",
    "sé": "saber", "ten": "tener", "haz": "hacer", "pon": "poner", "sal": "salir", "ven": "venir", "di": "decir",
    "oí": "oír", "oyes": "oír", "oye": "oír", "oímos": "oír", "oyen": "oír",
}

CLITICS = ["me", "te", "se", "lo", "la", "le", "nos", "os", "los", "las", "les"]
CLITIC_SUFFIXES = sorted({a + b for a in CLITICS for b in CLITICS} | set(CLITICS), key=len, reverse=True)

ACCENT_MAP = str.maketrans("áéíóú", "aeiou")


def strip_accents(s: str) -> str:
    return s.translate(ACCENT_MAP)


def _stem_variants(stem: str) -> set[str]:
    """Stammwechsel und Schreibanpassungen rückgängig machen."""
    out = {stem}
    swaps = [("ue", "o"), ("ie", "e"), ("i", "e"), ("u", "o"), ("qu", "c"), ("gu", "g"), ("c", "z"),
             ("j", "g"), ("zc", "c"), ("y", ""), ("güe", "go"), ("ie", "i")]
    for _ in range(2):
        for s in list(out):
            for a, b in swaps:
                idx = s.rfind(a)
                if idx != -1:
                    out.add(s[:idx] + b + s[idx + len(a):])
    return out


def _from_form(form: str) -> set[str]:
    cands: set[str] = set()
    if form in IRREGULAR_FORMS:
        cands.add(IRREGULAR_FORMS[form])
    # Futur/Konditional: Infinitiv + Endung
    for e in FUT_COND_ENDINGS:
        if form.endswith(e) and len(form) > len(e) + 2:
            cands.add(form[: -len(e)])
    for endings, infs in ((AR_ENDINGS, ["ar"]), (ER_IR_ENDINGS, ["er", "ir", "ír"])):
        for e in endings:
            if not form.endswith(e) or len(form) <= len(e):
                continue
            stem = form[: -len(e)]
            if stem in IRREGULAR_STEMS:
                cands.add(IRREGULAR_STEMS[stem])
            for v in _stem_variants(stem):
                for inf in infs:
                    cands.add(v + inf)
    # Futur/Konditional mit unregelmäßigem Stamm (tendrás, podrías)
    for e in FUT_COND_ENDINGS:
        if form.endswith(e) and form[: -len(e)] in IRREGULAR_STEMS:
            cands.add(IRREGULAR_STEMS[form[: -len(e)]])
    return cands


def infinitive_candidates(form: str, known_infinitives: set[str]) -> list[str]:
    """Alle plausiblen Infinitive für eine Wortform, die in known_infinitives vorkommen."""
    cands = set()
    forms = {form, strip_accents(form)}
    # angehängte Pronomen abtrennen (dime, hazlo, dímelo, vámonos, sentaos)
    for suffix in CLITIC_SUFFIXES:
        if form.endswith(suffix) and len(form) - len(suffix) >= 2:
            base = strip_accents(form[: -len(suffix)])
            forms.update({base, base + "s", base + "d"})
    for f in forms:
        if f in known_infinitives:
            cands.add(f)
        cands |= _from_form(f)
    return sorted(c for c in cands if c in known_infinitives)

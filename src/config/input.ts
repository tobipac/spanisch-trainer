// Comprehensible Input: Link zu Dreaming Spanish auf dem Heute-Screen (nach erreichtem Tagesziel).

/** Basis-URL der Videoliste (vom Nutzer bestätigt; leitet auf /spanish/browse weiter, Parameter bleiben erhalten). */
export const DREAMING_BROWSE_URL = 'https://app.dreaming.com/browse';

/** Ab so vielen gefestigten Wörtern zusätzlich Niveau „beginner“, darunter nur „superbeginner“. */
export const DREAMING_BEGINNER_FROM_STABLE_WORDS = 300;

/**
 * Filter-Parameter, auf app.dreaming.com durch Setzen der Filter abgelesen (28.09.2026):
 * Niveaus als Komma-Liste (level=beginner,superbeginner), „Hide watched“ = hide-watched=true.
 * Einen Filter „nur kostenlose Videos“ gibt es auf der Seite nicht.
 */
export const DREAMING_HIDE_WATCHED_PARAM = 'hide-watched';

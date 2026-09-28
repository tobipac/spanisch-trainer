// Link zu Dreaming Spanish mit vorgefilterter Videoliste. Reine Logik, getestet.
import { DREAMING_BEGINNER_FROM_STABLE_WORDS, DREAMING_BROWSE_URL, DREAMING_HIDE_WATCHED_PARAM } from '../config/input.ts';

export type DreamingLevel = 'superbeginner' | 'beginner';

/** Niveaus je nach gefestigten Wörtern: darunter nur superbeginner, ab der Schwelle zusätzlich beginner. */
export function dreamingLevels(stableWords: number): DreamingLevel[] {
  return stableWords >= DREAMING_BEGINNER_FROM_STABLE_WORDS ? ['beginner', 'superbeginner'] : ['superbeginner'];
}

/** Videoliste: passende Niveaus, gesehene Videos ausgeblendet. */
export function dreamingUrl(stableWords: number): string {
  const url = new URL(DREAMING_BROWSE_URL);
  url.searchParams.set('level', dreamingLevels(stableWords).join(','));
  url.searchParams.set(DREAMING_HIDE_WATCHED_PARAM, 'true');
  return url.toString();
}

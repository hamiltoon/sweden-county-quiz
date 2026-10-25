/**
 * Regler och typer för topplistan, delade mellan spelet (src/) och API:t (worker/).
 * Håll den här filen fri från DOM- och Worker-specifika API:er.
 */
import { COUNTIES } from '../data/counties';
import { LAKES } from '../data/lakes';
import { OTHER_CITIES } from '../data/cities';
import { PROVINCES } from '../data/provinces';
import { CONFIG } from '../game/config';

export const LEADERBOARD_MODES = ['lan', 'landskap', 'stad', 'ort', 'sjo', 'blandat'] as const;
export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number];

export const NAME_MAX_LENGTH = 20;
/** Max antal resultat i ett och samma POST-anrop (gamla rekord + den senaste omgången). */
export const MAX_RESULTS_PER_SUBMIT = 10;
export const TOP_LIMIT_DEFAULT = 10;
export const TOP_LIMIT_MAX = 50;

/** En flik på topplistan: ett läge, eller totalen (summan av spelarens bästa resultat i varje läge). */
export const TOTAL = 'total';
export type LeaderboardView = LeaderboardMode | typeof TOTAL;

export function isLeaderboardMode(value: unknown): value is LeaderboardMode {
  return typeof value === 'string' && (LEADERBOARD_MODES as readonly string[]).includes(value);
}

export function isLeaderboardView(value: unknown): value is LeaderboardView {
  return value === TOTAL || isLeaderboardMode(value);
}

/** Antal frågor i en omgång av ett läge. */
export function questionsForMode(mode: LeaderboardMode): number {
  if (mode === 'sjo') return LAKES.length;
  if (mode === 'landskap') return PROVINCES.length;
  if (mode === 'ort') return Math.min(CONFIG.otherCitiesPerRound, OTHER_CITIES.length);
  return COUNTIES.length;
}

/** Högsta möjliga poäng i en omgång: antal frågor gånger bästa poäng per fråga. */
export function maxScoreForMode(mode: LeaderboardMode): number {
  return questionsForMode(mode) * Math.max(...CONFIG.pointsByAttempt);
}

/** Högsta möjliga poäng för en flik; totalen är summan av alla lägens max. */
export function maxScoreForView(view: LeaderboardView): number {
  return view === TOTAL ? LEADERBOARD_MODES.reduce((sum, m) => sum + maxScoreForMode(m), 0) : maxScoreForMode(view);
}

/**
 * Städar ett spelarnamn: tar bort kontrolltecken, slår ihop blanksteg och kortar till max längd.
 * Returnerar null om inget namn finns kvar.
 */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(cleaned).slice(0, NAME_MAX_LENGTH).join('').trim();
  return chars.length > 0 ? chars : null;
}

/** Ett avslutat spelresultat som skickas till topplistan. */
export interface ScoreSubmission {
  /** Klientgenererat id (UUID), så att samma resultat aldrig sparas två gånger. */
  id: string;
  mode: LeaderboardMode;
  score: number;
  /** Andel rätt i procent, 0–100. */
  percent: number;
  /** När omgången spelades (ISO 8601). */
  playedAt: string;
}

export interface SubmitRequest {
  name: string;
  results: ScoreSubmission[];
}

export interface SubmitResponse {
  saved: number;
  /** Spelarens placering per läge, och totalt, efter sparandet (1 = bäst). */
  ranks: Partial<Record<LeaderboardView, number>>;
}

export interface TopEntry {
  name: string;
  score: number;
  /** Andel rätt i det bästa resultatet. Saknas i totalen. */
  percent?: number;
  /** Antal lägen som räknas in. Bara i totalen. */
  modes?: number;
  playedAt: string;
}

export interface TopResponse {
  mode: LeaderboardView;
  maxScore: number;
  top: TopEntry[];
}

import type { Mode } from './game';
import type { ScoreSubmission } from '../shared/leaderboard';

const BEST_KEY = 'sverigespelet.best.v1';
const NAME_KEY = 'sverigespelet.name.v1';
const PENDING_KEY = 'sverigespelet.pending.v1';
const MIGRATED_KEY = 'sverigespelet.migrated.v1';
/** Fler osända resultat än så här sparas inte (de äldsta släpps). */
const MAX_PENDING = 50;

export interface BestResult {
  score: number;
  percent: number;
  date: string;
  /** Resultatets id på topplistan. Saknas i rekord från före topplistan. */
  id?: string;
}

type BestMap = Partial<Record<Mode, BestResult>>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* privat läge etc. – ignorera */
  }
}

export function getBest(mode: Mode): BestResult | undefined {
  return read<BestMap>(BEST_KEY, {})[mode];
}

export function getAllBest(): BestMap {
  return read<BestMap>(BEST_KEY, {});
}

/** Sparar resultatet om det är bättre än tidigare. Returnerar true om nytt rekord. */
export function saveBest(mode: Mode, result: BestResult): boolean {
  const all = read<BestMap>(BEST_KEY, {});
  const prev = all[mode];
  if (prev && prev.score >= result.score) return false;
  all[mode] = result;
  write(BEST_KEY, all);
  return true;
}

/** Spelarens namn på topplistan, eller null om inget namn är valt än. */
export function getPlayerName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function savePlayerName(name: string): void {
  write(NAME_KEY, name);
}

/** Resultat som väntar på att skickas till topplistan (t.ex. för att telefonen var offline). */
export function getPending(): ScoreSubmission[] {
  const pending = read<unknown>(PENDING_KEY, []);
  return Array.isArray(pending) ? (pending as ScoreSubmission[]) : [];
}

export function addPending(results: ScoreSubmission[]): void {
  const byId = new Map(getPending().map((r) => [r.id, r]));
  for (const r of results) byId.set(r.id, r);
  write(PENDING_KEY, [...byId.values()].slice(-MAX_PENDING));
}

export function removePending(ids: Iterable<string>): void {
  const done = new Set(ids);
  write(
    PENDING_KEY,
    getPending().filter((r) => !done.has(r.id)),
  );
}

/** Har rekorden från före topplistan redan lagts i kön? */
export function isMigrated(): boolean {
  return read<boolean>(MIGRATED_KEY, false) === true;
}

export function markMigrated(): void {
  write(MIGRATED_KEY, true);
}

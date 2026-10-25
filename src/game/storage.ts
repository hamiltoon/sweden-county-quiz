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

export function clearPlayerName(): void {
  try {
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignorera */
  }
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

const LIVE_PLAYER_KEY = 'sverigespelet.liveplayer.v1';
const LIVE_NAME_KEY = 'sverigespelet.livename.v1';
let sessionLivePlayerId: string | null = null;

/**
 * Enhetens id i live-rummen, så att en återanslutning blir samma spelare. Går localStorage inte
 * att använda gäller id:t så länge sidan är öppen.
 */
export function getLivePlayerId(): string {
  const stored = read<string | null>(LIVE_PLAYER_KEY, null);
  if (typeof stored === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(stored)) return stored;
  sessionLivePlayerId ??= crypto.randomUUID();
  write(LIVE_PLAYER_KEY, JSON.stringify(sessionLivePlayerId));
  return sessionLivePlayerId;
}

/** Namnet i live-rummen; förifyllt med topplistans namn första gången. */
export function getLiveName(): string | null {
  const stored = read<string | null>(LIVE_NAME_KEY, null);
  return typeof stored === 'string' ? stored : getPlayerName();
}

export function saveLiveName(name: string): void {
  write(LIVE_NAME_KEY, JSON.stringify(name));
}

const LIVE_ROOM_KEY = 'sverigespelet.liveroom.v1';

/**
 * Rummet den här fliken är med i, så att en omladdning går rakt tillbaka in. Sparas per flik
 * (sessionStorage), så en delad länk i en ny flik visar ändå formuläret med namnet först.
 */
export function getCurrentLiveRoom(): string | null {
  try {
    return sessionStorage.getItem(LIVE_ROOM_KEY);
  } catch {
    return null;
  }
}

export function setCurrentLiveRoom(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(LIVE_ROOM_KEY, code);
    else sessionStorage.removeItem(LIVE_ROOM_KEY);
  } catch {
    /* privat läge etc. – ignorera */
  }
}

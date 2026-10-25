/**
 * Topplistan i klienten: hämtar listan och skickar resultat till /api/scores.
 *
 * Resultat läggs först i en kö i localStorage och skickas sedan, så att inget går förlorat om
 * telefonen är offline. Varje resultat har ett eget id, så ett omförsök sparar aldrig dubbelt.
 */
import {
  MAX_RESULTS_PER_SUBMIT,
  isLeaderboardMode,
  normalizeName,
  type LeaderboardView,
  type ScoreSubmission,
  type SubmitResponse,
  type TopResponse,
} from '../shared/leaderboard';
import {
  addPending,
  getAllBest,
  getPending,
  getPlayerName,
  isMigrated,
  markMigrated,
  removePending,
  savePlayerName,
} from '../game/storage';

const API = '/api/scores';
const TIMEOUT_MS = 8000;

export class LeaderboardError extends Error {
  constructor(
    message: string,
    /** HTTP-status, eller 0 om servern inte gick att nå. */
    readonly status: number,
  ) {
    super(message);
  }
}

export function newResultId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new LeaderboardError('Topplistan går inte att nå just nu.', 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new LeaderboardError(body?.error ?? `Fel från servern (${res.status}).`, res.status);
  return body;
}

export function fetchTop(mode: LeaderboardView, limit = 10): Promise<TopResponse> {
  return request<TopResponse>(`${API}?mode=${encodeURIComponent(mode)}&limit=${limit}`);
}

/**
 * Sparar namnet och lägger första gången rekorden från före topplistan i kön,
 * så att tidigare resultat i den här webbläsaren kommer med. Returnerar det städade namnet.
 */
export function setPlayerName(raw: string): string | null {
  const name = normalizeName(raw);
  if (!name) return null;
  savePlayerName(name);
  if (!isMigrated()) {
    const old: ScoreSubmission[] = [];
    for (const [mode, best] of Object.entries(getAllBest())) {
      if (!best || !isLeaderboardMode(mode) || best.score <= 0) continue;
      old.push({ id: best.id ?? newResultId(), mode, score: best.score, percent: best.percent, playedAt: best.date });
    }
    addPending(old);
    markMigrated();
  }
  return name;
}

/** Lägger ett avslutat resultat i kön (bara om spelaren har valt ett namn). */
export function queueResult(result: ScoreSubmission): boolean {
  if (!getPlayerName()) return false;
  addPending([result]);
  return true;
}

let flushing: Promise<SubmitResponse | null> | null = null;

/**
 * Skickar köade resultat. Returnerar serverns svar för den sista omgången som skickades,
 * eller null om kön var tom eller inget namn är valt. Kastar LeaderboardError vid fel;
 * resultaten ligger då kvar i kön, utom de som servern avvisade som ogiltiga.
 */
export function flushPending(): Promise<SubmitResponse | null> {
  flushing ??= doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(): Promise<SubmitResponse | null> {
  const name = getPlayerName();
  if (!name) return null;
  const total: SubmitResponse = { saved: 0, ranks: {} };
  let sent = false;
  const send = async (batch: ScoreSubmission[]) => {
    const res = await request<SubmitResponse>(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, results: batch }),
    });
    total.saved += res.saved;
    Object.assign(total.ranks, res.ranks);
    sent = true;
  };
  const rejected = (err: unknown) => err instanceof LeaderboardError && err.status === 400;

  for (let batch = nextBatch(); batch.length; batch = nextBatch()) {
    try {
      await send(batch);
    } catch (err) {
      if (!rejected(err)) throw err; // offline, 429 eller serverfel: försök igen senare
      // Servern avvisar hela anropet om ett resultat är ogiltigt. Skicka dem ett i taget
      // och släpp bara de som avvisas, så att kön inte fastnar.
      for (const r of batch) {
        try {
          await send([r]);
        } catch (e) {
          if (!rejected(e)) throw e;
        }
        removePending([r.id]);
      }
      continue;
    }
    removePending(batch.map((r) => r.id));
  }
  return sent ? total : null;
}

function nextBatch(): ScoreSubmission[] {
  return getPending().slice(0, MAX_RESULTS_PER_SUBMIT);
}

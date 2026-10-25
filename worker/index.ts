/**
 * Sverigespelets API: topplistan. Allt utom /api/* serveras direkt som statiska filer
 * (se run_worker_first i wrangler.jsonc), så den här koden körs bara för API-anropen.
 *
 *   GET  /api/scores?mode=lan&limit=10  → bästa resultat per spelare i ett läge
 *   POST /api/scores                     → spara ett eller flera avslutade resultat
 */
import {
  MAX_RESULTS_PER_SUBMIT,
  TOP_LIMIT_DEFAULT,
  TOP_LIMIT_MAX,
  isLeaderboardMode,
  maxScoreForMode,
  normalizeName,
  type LeaderboardMode,
  type ScoreSubmission,
  type SubmitResponse,
  type TopEntry,
  type TopResponse,
} from '../src/shared/leaderboard';
import { COUNTIES } from '../src/data/counties';
import { LAKES } from '../src/data/lakes';
import { CONFIG } from '../src/game/config';

const MAX_BODY_BYTES = 4096;
/** Resultat från före spelets första version, eller långt fram i tiden, är inte äkta. */
const EARLIEST_PLAYED_AT = Date.parse('2026-01-01T00:00:00Z');
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/scores') {
        if (request.method === 'GET') return await getTop(url, env);
        if (request.method === 'POST') return await submit(request, env);
        return json({ error: 'Metoden stöds inte.' }, 405, { Allow: 'GET, POST' });
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'Hittades inte.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('API-fel', err);
      return json({ error: 'Något gick fel på servern.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function getTop(url: URL, env: Env): Promise<Response> {
  const mode = url.searchParams.get('mode');
  if (!isLeaderboardMode(mode)) return json({ error: 'Okänt läge.' }, 400);
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), TOP_LIMIT_MAX) : TOP_LIMIT_DEFAULT;

  // Bästa resultat per spelare: vid lika poäng räknas det resultat som spelades först.
  const { results } = await env.DB.prepare(
    `SELECT name, score, percent, played_at AS playedAt FROM (
       SELECT name, score, percent, played_at,
              ROW_NUMBER() OVER (PARTITION BY name_key ORDER BY score DESC, played_at ASC, id) AS rn
       FROM scores WHERE mode = ?1
     )
     WHERE rn = 1
     ORDER BY score DESC, played_at ASC
     LIMIT ?2`,
  )
    .bind(mode, limit)
    .all<TopEntry>();

  const body: TopResponse = { mode, maxScore: maxScoreForMode(mode), top: results };
  return json(body);
}

async function submit(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'okänd';
  const { success } = await env.SUBMIT_LIMITER.limit({ key: ip });
  if (!success) return json({ error: 'För många försök. Vänta en minut och försök igen.' }, 429);

  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: 'För stor förfrågan.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'För stor förfrågan.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Ogiltig JSON.' }, 400);
  }

  const parsed = parseSubmit(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const { name, results } = parsed;
  const nameKey = name.toLocaleLowerCase('sv');

  const inserts = results.map((r) =>
    env.DB.prepare(
      `INSERT INTO scores (id, mode, name, name_key, score, percent, played_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT (id) DO NOTHING`,
    ).bind(r.id, r.mode, name, nameKey, r.score, r.percent, r.playedAt),
  );
  const outcomes = await env.DB.batch(inserts);
  const saved = outcomes.reduce((sum, o) => sum + (o.meta.changes ?? 0), 0);

  // Placering per läge för spelarens bästa resultat (delad placering vid lika poäng).
  const ranks: SubmitResponse['ranks'] = {};
  for (const mode of new Set(results.map((r) => r.mode))) {
    const row = await env.DB.prepare(
      `SELECT 1 + (
         SELECT COUNT(*) FROM (
           SELECT MAX(score) AS best FROM scores WHERE mode = ?1 GROUP BY name_key
         ) WHERE best > (SELECT MAX(score) FROM scores WHERE mode = ?1 AND name_key = ?2)
       ) AS rank`,
    )
      .bind(mode, nameKey)
      .first<{ rank: number }>();
    if (row) ranks[mode] = row.rank;
  }

  const response: SubmitResponse = { saved, ranks };
  return json(response, 201);
}

type Parsed = { name: string; results: ScoreSubmission[] } | { error: string };

function parseSubmit(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) return { error: 'Förväntade ett objekt.' };
  const { name: rawName, results: rawResults } = body as { name?: unknown; results?: unknown };
  const name = normalizeName(rawName);
  if (!name) return { error: 'Namn saknas.' };
  if (!Array.isArray(rawResults) || rawResults.length === 0) return { error: 'Inga resultat.' };
  if (rawResults.length > MAX_RESULTS_PER_SUBMIT) return { error: 'För många resultat på en gång.' };

  const results: ScoreSubmission[] = [];
  for (const raw of rawResults) {
    const result = parseResult(raw);
    if (typeof result === 'string') return { error: result };
    results.push(result);
  }
  return { name, results };
}

function parseResult(raw: unknown): ScoreSubmission | string {
  if (typeof raw !== 'object' || raw === null) return 'Ogiltigt resultat.';
  const { id, mode, score, percent, playedAt } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return 'Ogiltigt id.';
  if (!isLeaderboardMode(mode)) return 'Okänt läge.';
  if (!Number.isInteger(score) || !Number.isInteger(percent)) return 'Poäng och procent måste vara heltal.';
  const s = score as number;
  const p = percent as number;
  if (s < 0 || s > maxScoreForMode(mode)) return 'Omöjlig poäng.';
  if (p < 0 || p > 100) return 'Omöjlig procent.';
  if (!isConsistent(mode, s, p)) return 'Poäng och procent stämmer inte överens.';
  if (typeof playedAt !== 'string') return 'Datum saknas.';
  const t = Date.parse(playedAt);
  if (!Number.isFinite(t) || t < EARLIEST_PLAYED_AT || t > Date.now() + CLOCK_SKEW_MS) return 'Ogiltigt datum.';
  return { id, mode, score: s, percent: p, playedAt: new Date(t).toISOString() };
}

/**
 * Procenten avrundas från antal lösta frågor, och varje löst fråga ger mellan lägsta och högsta
 * poängen i CONFIG.pointsByAttempt. Med 21 eller 10 frågor går antalet lösta att räkna fram exakt
 * ur procenten.
 */
function isConsistent(mode: LeaderboardMode, score: number, percent: number): boolean {
  const total = mode === 'sjo' ? LAKES.length : COUNTIES.length;
  const solved = Math.round((percent * total) / 100);
  if (Math.round((100 * solved) / total) !== percent) return false;
  const minPoints = Math.min(...CONFIG.pointsByAttempt);
  const maxPoints = Math.max(...CONFIG.pointsByAttempt);
  return score >= solved * minPoints && score <= solved * maxPoints;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

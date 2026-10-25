/**
 * Sverigespelets API: topplistan och frivilliga konton med passkeys. Allt utom /api/* serveras
 * direkt som statiska filer (se run_worker_first i wrangler.jsonc), så den här koden körs bara
 * för API-anropen.
 *
 *   GET  /api/scores?mode=lan&limit=10    → bästa resultat per spelare i ett läge
 *   GET  /api/scores?mode=total&limit=10  → summan av varje spelares bästa resultat i alla lägen
 *   POST /api/scores                       → spara ett eller flera avslutade resultat
 *   /api/me, /api/logout, /api/passkey/*   → konton, se auth.ts
 *
 * Ett namn som skyddats med en passkey kan bara användas av den som är inloggad på det kontot.
 */
import {
  MAX_RESULTS_PER_SUBMIT,
  TOP_LIMIT_DEFAULT,
  TOP_LIMIT_MAX,
  TOTAL,
  isLeaderboardMode,
  isLeaderboardView,
  maxScoreForMode,
  maxScoreForView,
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
import { handleAuth, nameKeyOf, protectedPlayer, sessionPlayer } from './auth';
import { clientIp, isCrossOrigin, json, readJson } from './http';

const MAX_BODY_BYTES = 4096;
/** Resultat från före spelets första version, eller långt fram i tiden, är inte äkta. */
const EARLIEST_PLAYED_AT = Date.parse('2026-01-01T00:00:00Z');
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && isCrossOrigin(request, url)) {
        return json({ error: 'Anrop från andra webbplatser godtas inte.' }, 403);
      }
      const auth = await handleAuth(request, env, url);
      if (auth) return auth;
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
  if (!isLeaderboardView(mode)) return json({ error: 'Okänt läge.' }, 400);
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), TOP_LIMIT_MAX) : TOP_LIMIT_DEFAULT;

  if (mode === TOTAL) {
    // Summan av varje spelares bästa resultat per läge. Namnet visas som spelaren senast skrev det.
    // Vid lika summa står den som nådde summan först överst.
    const { results } = await env.DB.prepare(
      `WITH best AS (
         SELECT name_key, score, played_at,
                ROW_NUMBER() OVER (PARTITION BY name_key, mode ORDER BY score DESC, played_at ASC, id) AS rn
         FROM scores
       ),
       latest AS (
         SELECT name_key, name,
                ROW_NUMBER() OVER (PARTITION BY name_key ORDER BY created_at DESC, id) AS rn
         FROM scores
       )
       SELECT latest.name AS name, SUM(best.score) AS score, COUNT(*) AS modes, MAX(best.played_at) AS playedAt
       FROM best JOIN latest ON latest.name_key = best.name_key AND latest.rn = 1
       WHERE best.rn = 1
       GROUP BY best.name_key
       ORDER BY score DESC, playedAt ASC
       LIMIT ?1`,
    )
      .bind(limit)
      .all<TopEntry>();
    const body: TopResponse = { mode, maxScore: maxScoreForView(mode), top: results };
    return json(body);
  }

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
  const { success } = await env.SUBMIT_LIMITER.limit({ key: clientIp(request) });
  if (!success) return json({ error: 'För många försök. Vänta en minut och försök igen.' }, 429);

  const read = await readJson(request, MAX_BODY_BYTES);
  if ('error' in read) return read.error;
  const parsed = parseSubmit(read.body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const { results } = parsed;

  // Inloggad: resultaten sparas alltid under kontots namn. Annars får bara namn som ingen
  // skyddat med en passkey användas.
  const account = await sessionPlayer(request, env);
  let name = parsed.name;
  if (account) {
    name = account.name;
  } else {
    const owner = await protectedPlayer(env, nameKeyOf(name));
    if (owner) {
      return json({ error: `Namnet ${owner.name} är skyddat. Logga in med din passkey eller välj ett annat namn.` }, 403);
    }
  }
  const nameKey = nameKeyOf(name);

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

  // Placering i totalen: antal spelare vars summa av bästa resultat per läge är högre.
  const totalRow = await env.DB.prepare(
    `WITH totals AS (
       SELECT name_key, SUM(best) AS total FROM (
         SELECT name_key, MAX(score) AS best FROM scores GROUP BY name_key, mode
       ) GROUP BY name_key
     )
     SELECT 1 + (SELECT COUNT(*) FROM totals WHERE total > (SELECT total FROM totals WHERE name_key = ?1)) AS rank`,
  )
    .bind(nameKey)
    .first<{ rank: number }>();
  if (totalRow) ranks[TOTAL] = totalRow.rank;

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

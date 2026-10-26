/**
 * Minnesreglerna (PO-33): röster, "hjälpte regeln?", kommentarer och förslag. Reglerna själva
 * ligger i koden (src/data/mnemonics.ts). Inget här påverkar topplistan.
 *
 *   GET  /api/mnemonics?device=…    → röster, "hjälpte"-svar, kommentarer, förslag och ifrågasatta
 *                                     regler, plus enhetens egna röster
 *   POST /api/mnemonics/vote        → 👍/👎 (eller 0 för att ta tillbaka), en röst per regel och enhet
 *   POST /api/mnemonics/helped      → svaret på "Hjälpte minnesregeln?", en gång per regel och enhet
 *   POST /api/mnemonics/comment     → en kommentar till en regel
 *   POST /api/mnemonics/suggest     → ett eget förslag eller en önskan
 *
 * POST begränsas per IP-adress med samma gräns som topplistan, men med egen räknare.
 */
import { MNEMONIC_BY_ID } from '../src/data/mnemonics';
import { normalizeName } from '../src/shared/leaderboard';
import {
  DEVICE_PATTERN,
  QUESTIONED_MIN_VOTES,
  normalizeText,
  type MnemonicsResponse,
  type RuleComment,
  type RuleStats,
  type RuleSuggestion,
  type Vote,
} from '../src/shared/mnemonics';
import { clientIp, json, readJson } from './http';
import { msg, type ServerMessages } from './messages';

const MAX_BODY_BYTES = 4096;
const BASE = '/api/mnemonics';

export async function handleMnemonics(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return null;
  const m = msg(request);
  if (url.pathname === BASE) {
    if (request.method !== 'GET') return json({ error: m.method }, 405, { Allow: 'GET' });
    return getAll(env, url.searchParams.get('device'));
  }
  const action = url.pathname.slice(BASE.length + 1);
  if (!['vote', 'helped', 'comment', 'suggest'].includes(action)) return json({ error: m.notFound }, 404);
  if (request.method !== 'POST') return json({ error: m.method }, 405, { Allow: 'POST' });

  const { success } = await env.SUBMIT_LIMITER.limit({ key: `mnemonics:${clientIp(request)}` });
  if (!success) return json({ error: m.tooMany }, 429);
  const read = await readJson(request, MAX_BODY_BYTES);
  if ('error' in read) return read.error;
  if (typeof read.body !== 'object' || read.body === null) return json({ error: m.expectedObject }, 400);
  const body = read.body as Record<string, unknown>;
  if (typeof body.device !== 'string' || !DEVICE_PATTERN.test(body.device)) return json({ error: m.badDevice }, 400);
  const device = body.device;

  if (action === 'suggest') {
    const text = normalizeText(body.text);
    if (!text) return json({ error: m.noText }, 400);
    if (body.kind !== 'rule' && body.kind !== 'wish') return json({ error: m.badKind }, 400);
    await env.DB.prepare('INSERT INTO mnemonic_suggestions (device, name, kind, text) VALUES (?1, ?2, ?3, ?4)')
      .bind(device, normalizeName(body.name), body.kind, text)
      .run();
    return json({ ok: true }, 201);
  }

  const ruleId = checkRule(body.ruleId, m);
  if (typeof ruleId !== 'string') return ruleId;
  if (action === 'vote') {
    if (body.vote === 0) {
      await env.DB.prepare('DELETE FROM mnemonic_votes WHERE rule_id = ?1 AND device = ?2').bind(ruleId, device).run();
      return json({ ok: true });
    }
    if (body.vote !== 1 && body.vote !== -1) return json({ error: m.badVote }, 400);
    await env.DB.prepare(
      `INSERT INTO mnemonic_votes (rule_id, device, vote) VALUES (?1, ?2, ?3)
       ON CONFLICT (rule_id, device) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`,
    )
      .bind(ruleId, device, body.vote)
      .run();
    return json({ ok: true });
  }
  if (action === 'helped') {
    if (typeof body.helped !== 'boolean') return json({ error: m.badVote }, 400);
    // Första svaret gäller; frågan ställs bara en gång per regel och enhet.
    await env.DB.prepare('INSERT INTO mnemonic_helped (rule_id, device, helped) VALUES (?1, ?2, ?3) ON CONFLICT (rule_id, device) DO NOTHING')
      .bind(ruleId, device, body.helped ? 1 : 0)
      .run();
    return json({ ok: true });
  }
  const text = normalizeText(body.text);
  if (!text) return json({ error: m.noText }, 400);
  await env.DB.prepare('INSERT INTO mnemonic_comments (rule_id, device, name, text) VALUES (?1, ?2, ?3, ?4)')
    .bind(ruleId, device, normalizeName(body.name), text)
    .run();
  return json({ ok: true }, 201);
}

function checkRule(raw: unknown, m: ServerMessages): string | Response {
  return typeof raw === 'string' && MNEMONIC_BY_ID.has(raw) ? raw : json({ error: m.badRule }, 400);
}

async function getAll(env: Env, device: string | null): Promise<Response> {
  const [votes, helped, comments, suggestions, mine] = await env.DB.batch([
    env.DB.prepare(
      'SELECT rule_id AS id, SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM mnemonic_votes GROUP BY rule_id',
    ),
    env.DB.prepare('SELECT rule_id AS id, SUM(helped = 1) AS yes, SUM(helped = 0) AS no FROM mnemonic_helped GROUP BY rule_id'),
    env.DB.prepare(
      'SELECT id, rule_id AS ruleId, name, text, created_at AS createdAt FROM mnemonic_comments ORDER BY created_at DESC LIMIT 500',
    ),
    env.DB.prepare('SELECT id, kind, name, text, created_at AS createdAt FROM mnemonic_suggestions ORDER BY created_at DESC LIMIT 500'),
    env.DB.prepare('SELECT rule_id AS id, vote FROM mnemonic_votes WHERE device = ?1').bind(device && DEVICE_PATTERN.test(device) ? device : ''),
  ]);
  const voteRows = new Map((votes.results as { id: string; up: number; down: number }[]).map((r) => [r.id, r]));
  const helpedRows = new Map((helped.results as { id: string; yes: number; no: number }[]).map((r) => [r.id, r]));
  const rules: RuleStats[] = [...MNEMONIC_BY_ID.keys()].map((id) => {
    const up = voteRows.get(id)?.up ?? 0;
    const down = voteRows.get(id)?.down ?? 0;
    return {
      id,
      up,
      down,
      helpedYes: helpedRows.get(id)?.yes ?? 0,
      helpedNo: helpedRows.get(id)?.no ?? 0,
      questioned: up + down >= QUESTIONED_MIN_VOTES && down > up,
    };
  });
  const body: MnemonicsResponse = {
    rules,
    comments: comments.results as unknown as RuleComment[],
    suggestions: suggestions.results as unknown as RuleSuggestion[],
    mine: Object.fromEntries((mine.results as { id: string; vote: Vote }[]).map((r) => [r.id, r.vote])),
  };
  return json(body);
}

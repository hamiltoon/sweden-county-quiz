/**
 * Minnesreglerna i spelet (PO-33): vilken regel som hör till en fråga, tipset i lägets kort, och det
 * enheten minns om reglerna. Rösterna och svaren skickas till /api/mnemonics.
 *
 * Ett 👎 döljer regeln direkt bara på den här enheten. För alla döljs ingen regel automatiskt; en
 * regel med många 👎 markeras som ifrågasatt, och PO avgör.
 */
import { MNEMONICS, type Mnemonic, type MnemonicTarget, type MnemonicText } from '../data/mnemonics';
import type { Mode, Question } from '../game/game';
import { lang } from '../i18n';
import type { CommentRequest, HelpedRequest, MnemonicsResponse, SuggestRequest, Vote, VoteRequest } from '../shared/mnemonics';

const DEVICE_KEY = 'sverigespelet.device.v1';
const VOTES_KEY = 'sverigespelet.mnemonicVotes.v1';
const SEEN_KEY = 'sverigespelet.mnemonicSeen.v1';
const ASKED_KEY = 'sverigespelet.mnemonicAsked.v1';
const API = '/api/mnemonics';
const TIMEOUT_MS = 8000;

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
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* utan lagring */
  }
}

let sessionDevice: string | null = null;

/** Enhetens slumpade id, som rösterna sparas under. */
export function deviceId(): string {
  const stored = read<string | null>(DEVICE_KEY, null);
  if (typeof stored === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(stored)) return stored;
  sessionDevice ??= crypto.randomUUID();
  write(DEVICE_KEY, sessionDevice);
  return sessionDevice;
}

/** Texten på spelets språk, eller null om regeln saknar text på engelska. */
export function textOf(rule: Mnemonic): MnemonicText | null {
  return lang() === 'sv' ? rule : (rule.en ?? null);
}

/** Enhetens egna röster. */
export function myVotes(): Record<string, Vote> {
  return read<Record<string, Vote>>(VOTES_KEY, {});
}

/** Regler som går att visa: på rätt språk och inte bortröstade på enheten. */
function usable(rule: Mnemonic): boolean {
  return !!textOf(rule) && myVotes()[rule.id] !== -1;
}

/** Vad frågan gäller, som det står i reglernas `targets`. */
function targetOf(q: Question): [MnemonicTarget, string] | null {
  switch (q.kind) {
    case 'lan':
    case 'stad':
      return [q.kind, q.county.code];
    case 'landskap':
      return ['landskap', q.province.code];
    case 'kommun':
      return ['kommun', q.municipality.code];
    case 'sjo':
      return ['sjo', q.lake.id];
    default:
      return null;
  }
}

/** Regeln för just den här saken: en regel om saken själv före en tankeregel som gäller flera. */
export function ruleFor(q: Question): Mnemonic | null {
  const target = targetOf(q);
  if (!target) return null;
  const [kind, id] = target;
  const matching = MNEMONICS.filter((r) => r.targets[kind]?.includes(id) && usable(r));
  return matching.find((r) => r.category !== 'princip') ?? matching[0] ?? null;
}

/** Vilka sorters frågor ett läge har. */
const MODE_TARGETS: Record<Mode, MnemonicTarget[]> = {
  lan: ['lan'],
  stad: ['stad'],
  landskap: ['landskap'],
  kommun: ['kommun'],
  ort: [],
  sjo: ['sjo'],
  blandat: ['lan', 'stad', 'landskap', 'kommun', 'sjo'],
};

/**
 * Tipset i lägets kort: en tankeregel (princip) med kort text som gäller läget. Samma tips hela
 * dagen, så att kortet inte byter text varje gång startskärmen ritas om.
 */
export function tipFor(mode: Mode): string | null {
  const kinds = MODE_TARGETS[mode];
  const tips = MNEMONICS.filter((r) => r.category === 'princip' && usable(r) && textOf(r)?.short && kinds.some((k) => r.targets[k]));
  if (!tips.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  return textOf(tips[day % tips.length])!.short!;
}

/**
 * Var en regel har visats: omgångens id första gången. "Hjälpte regeln?" frågas bara om en regel
 * som visades i en tidigare omgång.
 */
export function markSeen(ruleId: string, round: string): void {
  const seen = read<Record<string, string>>(SEEN_KEY, {});
  if (seen[ruleId]) return;
  seen[ruleId] = round;
  write(SEEN_KEY, seen);
}

/** Regeln visades i en tidigare omgång, och "Hjälpte regeln?" har inte frågats om den. */
export function shouldAskHelped(ruleId: string, round: string): boolean {
  const seenIn = read<Record<string, string>>(SEEN_KEY, {})[ruleId];
  return !!seenIn && seenIn !== round && !read<string[]>(ASKED_KEY, []).includes(ruleId);
}

function markAsked(ruleId: string): void {
  const asked = read<string[]>(ASKED_KEY, []);
  if (!asked.includes(ruleId)) write(ASKED_KEY, [...asked, ruleId]);
}

export class MnemonicsError extends Error {}

async function post(path: string, body: VoteRequest | HelpedRequest | CommentRequest | SuggestRequest): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new MnemonicsError('offline');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new MnemonicsError(data?.error ?? String(res.status));
  }
}

/**
 * Röstar 👍 (1), 👎 (-1) eller tar tillbaka rösten (0). Rösten gäller direkt på enheten, även om
 * den inte når servern.
 */
export async function vote(ruleId: string, value: Vote | 0): Promise<void> {
  const votes = myVotes();
  if (value === 0) delete votes[ruleId];
  else votes[ruleId] = value;
  write(VOTES_KEY, votes);
  await post('vote', { device: deviceId(), ruleId, vote: value });
}

export async function answerHelped(ruleId: string, helped: boolean): Promise<void> {
  markAsked(ruleId);
  await post('helped', { device: deviceId(), ruleId, helped });
}

export async function comment(ruleId: string, text: string, name?: string): Promise<void> {
  await post('comment', { device: deviceId(), ruleId, text, name });
}

export async function suggest(kind: SuggestRequest['kind'], text: string, name?: string): Promise<void> {
  await post('suggest', { device: deviceId(), kind, text, name });
}

export async function fetchMnemonics(): Promise<MnemonicsResponse> {
  const res = await fetch(`${API}?device=${encodeURIComponent(deviceId())}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new MnemonicsError(String(res.status));
  return (await res.json()) as MnemonicsResponse;
}

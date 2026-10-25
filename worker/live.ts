/**
 * Live-läget: rum där flera spelare får samma fråga samtidigt.
 *
 *   POST /api/live             → skapar ett rum och svarar med koden
 *   GET  /api/live/:kod/ws     → WebSocket in i rummet (?player=<id>&name=<namn>)
 *
 * Varje rum är ett Durable Object (LiveRoom) som håller spelarna, frågorna och poängen. Rummet
 * använder WebSocket-hibernering, så det kan sova mellan meddelandena; därför sparas allt i
 * rummets lagring och läses in igen när det vaknar. Tiderna styrs med alarm.
 */
import { DurableObject } from 'cloudflare:workers';
import { COUNTIES, COUNTY_BY_CODE } from '../src/data/counties';
import { PROVINCES, PROVINCE_BY_CODE } from '../src/data/provinces';
import { MUNICIPALITIES, MUNICIPALITY_BY_CODE } from '../src/data/municipalities';
import { OTHER_CITIES } from '../src/data/cities';
import { LAKES, LAKE_BY_ID } from '../src/data/lakes';
import { CONFIG } from '../src/game/config';
import { haversineKm } from '../src/game/geo';
import { normalizeName } from '../src/shared/leaderboard';
import {
  LIVE_CODE_ALPHABET,
  LIVE_CODE_LENGTH,
  LIVE_CODE_PATTERN,
  LIVE_IDLE_MS,
  LIVE_MAX_PLAYERS,
  LIVE_QUESTIONS,
  LIVE_QUESTION_MS,
  LIVE_REVEAL_MS,
  isLiveMode,
  isPointKind,
  livePoints,
  type LiveAnswer,
  type LiveClientMessage,
  type LiveCreateResponse,
  type LiveMode,
  type LivePhase,
  type LiveQuestion,
  type LiveServerMessage,
  type LiveState,
} from '../src/shared/live';
import { clientIp, json } from './http';
import { langOf, messages, msg } from './messages';
import type { Lang } from '../src/shared/i18n';

const PLAYER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_MESSAGE_BYTES = 512;
const WS_OPEN = 1;

interface StoredPlayer {
  id: string;
  name: string;
  score: number;
}

interface StoredAnswer {
  code: string | null;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  correct: boolean;
  points: number;
}

/** Det som sparas med varje anslutning, så att rummet vet vem den tillhör även efter hibernering. */
interface Attachment {
  playerId: string;
  /** Spelarens språk, för felmeddelanden. */
  lang: Lang;
}

interface Room {
  code: string;
  mode: LiveMode;
  phase: LivePhase;
  hostId: string | null;
  players: StoredPlayer[];
  /** Matchens frågor, i ordning. */
  questions: LiveQuestion[];
  index: number;
  questionStartedAt: number;
  endsAt: number;
  answers: Record<string, StoredAnswer>;
  lastActive: number;
}

/** Hanterar /api/live*. Returnerar null för andra sökvägar. */
export async function handleLive(request: Request, env: Env, url: URL): Promise<Response | null> {
  const m = msg(request);
  if (url.pathname === '/api/live') {
    if (request.method !== 'POST') return json({ error: m.method }, 405, { Allow: 'POST' });
    const { success } = await env.SUBMIT_LIMITER.limit({ key: `live:${clientIp(request)}` });
    if (!success) return json({ error: m.tooManyRooms }, 429);
    // Koden slumpas; i den osannolika händelsen att den redan används provas en ny.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const res = await env.LIVE_ROOM.getByName(code).fetch(`https://live/init?code=${code}`, { method: 'POST' });
      if (res.status === 201) return json({ code } satisfies LiveCreateResponse, 201);
    }
    return json({ error: m.roomCreateFailed }, 503);
  }

  const match = /^\/api\/live\/([^/]+)\/ws$/.exec(url.pathname);
  if (!match) return null;
  const code = match[1].toUpperCase();
  if (!LIVE_CODE_PATTERN.test(code)) return json({ error: m.badRoomCode }, 404);
  if (request.headers.get('Upgrade') !== 'websocket') return json({ error: m.expectedWebSocket }, 426);
  // En WebSocket skickar alltid Origin; andra webbplatser får inte ansluta i spelarens namn.
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== url.origin) return json({ error: m.crossOrigin }, 403);
  return env.LIVE_ROOM.getByName(code).fetch(new Request(`https://live/ws${url.search}`, request));
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LIVE_CODE_LENGTH));
  return Array.from(bytes, (b) => LIVE_CODE_ALPHABET[b % LIVE_CODE_ALPHABET.length]).join('');
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const CITY_BY_NAME = new Map(OTHER_CITIES.map((c) => [c.name, c]));

/** Frågorna för en match: tio slumpade ur lägets lista. Blandat slumpar län eller residensstad. */
function buildQuestions(mode: LiveMode): LiveQuestion[] {
  const pick = <T>(items: readonly T[], toQuestion: (item: T) => LiveQuestion) => shuffled(items).slice(0, LIVE_QUESTIONS).map(toQuestion);
  switch (mode) {
    case 'landskap':
      return pick(PROVINCES, (p) => ({ kind: 'landskap', target: p.code }));
    case 'kommun':
      return pick(MUNICIPALITIES, (m) => ({ kind: 'kommun', target: m.code }));
    case 'ort':
      return pick(OTHER_CITIES, (c) => ({ kind: 'ort', target: c.name }));
    case 'sjo':
      return pick(LAKES, (l) => ({ kind: 'sjo', target: l.id }));
    case 'stad':
      return pick(COUNTIES, (c) => ({ kind: 'stad', target: c.code }));
    case 'blandat':
      return pick(COUNTIES, (c) => ({ kind: crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? 'lan' : 'stad', target: c.code }));
    default:
      return pick(COUNTIES, (c) => ({ kind: 'lan', target: c.code }));
  }
}

/** Var staden i en stadsfråga ligger. */
function targetPoint(q: LiveQuestion): { lat: number; lon: number } | undefined {
  return q.kind === 'stad' ? COUNTY_BY_CODE.get(q.target) : CITY_BY_NAME.get(q.target);
}

/** Finns området eller sjön i frågans kategori? */
function isKnownCode(q: LiveQuestion, code: string): boolean {
  if (q.kind === 'landskap') return PROVINCE_BY_CODE.has(code);
  if (q.kind === 'kommun') return MUNICIPALITY_BY_CODE.has(code);
  if (q.kind === 'sjo') return LAKE_BY_ID.has(code);
  return COUNTY_BY_CODE.has(code);
}

const isCoordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/**
 * Bedömer ett svar. Områden och sjöar är rätt om koden stämmer; städerna om klicket ligger inom
 * CONFIG.cityRadiusKm. I sjöläget räknas ett klick på land som fel. Ogiltiga svar ger null.
 */
function judge(q: LiveQuestion, answer: { code?: unknown; lat?: unknown; lon?: unknown }): Omit<StoredAnswer, 'points'> | null {
  const point = isCoordinate(answer.lat, 50, 75) && isCoordinate(answer.lon, -5, 40) ? { lat: answer.lat, lon: answer.lon } : null;
  if (isPointKind(q.kind)) {
    const target = targetPoint(q);
    if (!point || !target) return null;
    const km = haversineKm(point.lat, point.lon, target.lat, target.lon);
    return { code: null, ...point, distanceKm: Math.round(km), correct: km <= CONFIG.cityRadiusKm };
  }
  if (typeof answer.code === 'string' && isKnownCode(q, answer.code)) return { code: answer.code, correct: answer.code === q.target };
  if (q.kind === 'sjo' && point) return { code: null, ...point, correct: false };
  return null;
}

export class LiveRoom extends DurableObject<Env> {
  private room: Room | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>('room')) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init') return this.init(url.searchParams.get('code') ?? '');
    return this.join(url, langOf(request));
  }

  private async init(code: string): Promise<Response> {
    if (this.room) return new Response(null, { status: 409 });
    const now = Date.now();
    this.room = {
      code,
      mode: 'lan',
      phase: 'lobby',
      hostId: null,
      players: [],
      questions: [],
      index: 0,
      questionStartedAt: 0,
      endsAt: 0,
      answers: {},
      lastActive: now,
    };
    await this.save();
    await this.ctx.storage.setAlarm(now + LIVE_IDLE_MS);
    return new Response(null, { status: 201 });
  }

  private async join(url: URL, lang: Lang): Promise<Response> {
    const m = messages(lang);
    const [client, server] = Object.values(new WebSocketPair());
    const refuse = (message: string) => {
      server.accept();
      server.send(JSON.stringify({ type: 'error', message, fatal: true } satisfies LiveServerMessage));
      server.close(4000, 'Avvisad');
      return new Response(null, { status: 101, webSocket: client });
    };

    const room = this.room;
    if (!room) return refuse(m.noRoom);
    const playerId = url.searchParams.get('player') ?? '';
    const name = normalizeName(url.searchParams.get('name'));
    if (!PLAYER_ID_PATTERN.test(playerId)) return refuse(m.badPlayer);
    if (!name) return refuse(m.writeName);

    let player = room.players.find((p) => p.id === playerId);
    if (!player) {
      if (room.players.length >= LIVE_MAX_PLAYERS) return refuse(m.roomFull(LIVE_MAX_PLAYERS));
      player = { id: playerId, name: uniqueName(room, name, playerId), score: 0 };
      room.players.push(player);
    } else {
      player.name = uniqueName(room, name, playerId);
    }

    // Samma spelare i en annan flik eller efter en återanslutning: den gamla anslutningen stängs.
    for (const old of this.ctx.getWebSockets(playerId)) old.close(4001, 'Ansluten på nytt');
    this.ctx.acceptWebSocket(server, [playerId]);
    server.serializeAttachment({ playerId, lang } satisfies Attachment);

    if (!room.hostId || !this.isConnected(room.hostId, server)) room.hostId = playerId;
    room.lastActive = Date.now();
    await this.save();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = this.room;
    if (!room || typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return;
    const { playerId, lang } = ws.deserializeAttachment() as Attachment;
    let msg: LiveClientMessage;
    try {
      msg = JSON.parse(raw) as LiveClientMessage;
    } catch {
      return;
    }
    room.lastActive = Date.now();

    if (msg.type === 'start') {
      if (playerId !== room.hostId) return this.sendError(ws, messages(lang).hostOnly);
      if (room.phase !== 'lobby' && room.phase !== 'done') return;
      for (const p of room.players) p.score = 0;
      room.questions = buildQuestions(room.mode);
      room.index = 0;
      await this.startQuestion();
    } else if (msg.type === 'mode') {
      if (playerId !== room.hostId || (room.phase !== 'lobby' && room.phase !== 'done') || !isLiveMode(msg.mode)) return;
      room.mode = msg.mode;
      await this.save();
      this.broadcast();
    } else if (msg.type === 'answer') {
      if (room.phase !== 'question' || msg.question !== room.index || room.answers[playerId]) return;
      if (!room.players.some((p) => p.id === playerId)) return;
      const judged = judge(room.questions[room.index], msg);
      if (!judged) return;
      const points = judged.correct ? livePoints(Date.now() - room.questionStartedAt) : 0;
      room.answers[playerId] = { ...judged, points };
      if (this.everyoneAnswered()) await this.reveal();
      else {
        await this.save();
        this.broadcast();
      }
    } else if (msg.type === 'lobby') {
      if (playerId !== room.hostId || room.phase !== 'done') return;
      for (const p of room.players) p.score = 0;
      room.phase = 'lobby';
      room.answers = {};
      await this.save();
      this.broadcast();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, 'Hej då');
    } catch {
      /* redan stängd */
    }
    await this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.onDisconnect(ws);
  }

  private async onDisconnect(ws: WebSocket): Promise<void> {
    const room = this.room;
    if (!room) return;
    const { playerId } = (ws.deserializeAttachment() as { playerId: string } | null) ?? { playerId: '' };
    // Om värden försvinner tar nästa anslutna spelare över, så att någon kan starta.
    if (room.hostId === playerId && !this.isConnected(playerId, ws)) {
      room.hostId = room.players.find((p) => p.id !== playerId && this.isConnected(p.id, ws))?.id ?? room.hostId;
    }
    if (room.phase === 'question' && this.everyoneAnswered(ws)) await this.reveal();
    else {
      await this.save();
      this.broadcast(ws);
    }
  }

  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.phase === 'question' || room.phase === 'reveal') {
      // Ett alarm som kommer för tidigt (t.ex. från en tidigare fas) flyttas fram.
      if (now < room.endsAt - 50) return this.ctx.storage.setAlarm(room.endsAt);
      if (room.phase === 'question') return this.reveal();
      room.index += 1;
      if (room.index < room.questions.length) return this.startQuestion();
      room.phase = 'done';
      room.answers = {};
      await this.save();
      this.broadcast();
      return this.ctx.storage.setAlarm(now + LIVE_IDLE_MS);
    }
    if (now - room.lastActive < LIVE_IDLE_MS) return this.ctx.storage.setAlarm(room.lastActive + LIVE_IDLE_MS);
    // Rummet har inte använts på länge: stäng det och töm lagringen.
    for (const ws of this.ctx.getWebSockets()) ws.close(4002, 'Rummet har stängts');
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  private async startQuestion(): Promise<void> {
    const room = this.room!;
    const now = Date.now();
    room.phase = 'question';
    room.answers = {};
    room.questionStartedAt = now;
    room.endsAt = now + LIVE_QUESTION_MS;
    await this.save();
    await this.ctx.storage.setAlarm(room.endsAt);
    this.broadcast();
  }

  private async reveal(): Promise<void> {
    const room = this.room!;
    for (const p of room.players) p.score += room.answers[p.id]?.points ?? 0;
    room.phase = 'reveal';
    room.endsAt = Date.now() + LIVE_REVEAL_MS;
    await this.save();
    await this.ctx.storage.setAlarm(room.endsAt);
    this.broadcast();
  }

  /** Alla anslutna spelare har svarat (och minst en är ansluten). */
  private everyoneAnswered(closing?: WebSocket): boolean {
    const room = this.room!;
    const connected = room.players.filter((p) => this.isConnected(p.id, closing));
    return connected.length > 0 && connected.every((p) => room.answers[p.id]);
  }

  /** Har spelaren en öppen anslutning, bortsett från `except` (som håller på att stängas)? */
  private isConnected(playerId: string, except?: WebSocket): boolean {
    return this.ctx.getWebSockets(playerId).some((ws) => ws !== except && ws.readyState === WS_OPEN);
  }

  private save(): Promise<void> {
    return this.ctx.storage.put('room', this.room);
  }

  private sendError(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({ type: 'error', message, fatal: false } satisfies LiveServerMessage));
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== WS_OPEN) continue;
      const { playerId } = ws.deserializeAttachment() as { playerId: string };
      ws.send(JSON.stringify({ type: 'state', state: this.stateFor(playerId, now, except) } satisfies LiveServerMessage));
    }
  }

  private stateFor(you: string, now: number, closing?: WebSocket): LiveState {
    const room = this.room!;
    const inRound = room.phase === 'question' || room.phase === 'reveal';
    const state: LiveState = {
      code: room.code,
      mode: room.mode,
      phase: room.phase,
      hostId: room.hostId,
      you,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: this.isConnected(p.id, closing),
        answered: room.phase === 'question' && Boolean(room.answers[p.id]),
      })),
      serverNow: now,
    };
    if (inRound) {
      const q = room.questions[room.index];
      state.question = { index: room.index, total: room.questions.length, kind: q.kind, target: q.target, endsAt: room.endsAt };
    }
    if (room.phase === 'reveal') {
      state.answers = room.players.map((p): LiveAnswer => {
        const a = room.answers[p.id];
        return a ? { playerId: p.id, ...a } : { playerId: p.id, code: null, correct: false, points: 0 };
      });
    }
    return state;
  }
}

/** Två spelare med samma namn i ett rum blir "Anna" och "Anna 2". */
function uniqueName(room: Room, name: string, playerId: string): string {
  const taken = new Set(room.players.filter((p) => p.id !== playerId).map((p) => p.name.toLocaleLowerCase('sv')));
  if (!taken.has(name.toLocaleLowerCase('sv'))) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate.toLocaleLowerCase('sv'))) return candidate;
  }
}

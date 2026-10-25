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
  livePoints,
  type LiveAnswer,
  type LiveClientMessage,
  type LiveCreateResponse,
  type LiveMode,
  type LivePhase,
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
  code: string;
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
  /** Länskoderna för matchens frågor, i ordning. */
  questions: string[];
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
      room.questions = shuffled(COUNTIES)
        .slice(0, LIVE_QUESTIONS)
        .map((c) => c.code);
      room.index = 0;
      await this.startQuestion();
    } else if (msg.type === 'answer') {
      if (room.phase !== 'question' || msg.question !== room.index || room.answers[playerId]) return;
      if (typeof msg.code !== 'string' || !COUNTY_BY_CODE.has(msg.code)) return;
      if (!room.players.some((p) => p.id === playerId)) return;
      const correct = msg.code === room.questions[room.index];
      const points = correct ? livePoints(Date.now() - room.questionStartedAt) : 0;
      room.answers[playerId] = { code: msg.code, correct, points };
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
      state.question = { index: room.index, total: room.questions.length, target: room.questions[room.index], endsAt: room.endsAt };
    }
    if (room.phase === 'reveal') {
      state.answers = room.players.map(
        (p): LiveAnswer => ({ playerId: p.id, code: room.answers[p.id]?.code ?? null, correct: room.answers[p.id]?.correct ?? false, points: room.answers[p.id]?.points ?? 0 }),
      );
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

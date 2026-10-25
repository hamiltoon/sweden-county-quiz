/**
 * Live-läget: regler, konstanter och meddelanden mellan spelet (src/) och rummen i Worker-scriptet
 * (worker/live.ts). Ett rum är ett Durable Object; spelarna är anslutna med WebSocket och servern
 * skickar hela rummets läge efter varje ändring.
 */

/** Rumskoder: fyra tecken utan sådana som är lätta att blanda ihop (0/O, 1/I/L). */
export const LIVE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LIVE_CODE_LENGTH = 4;
export const LIVE_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

/** Live-lägena: samma som spelets lägen. Värden väljer läge i lobbyn. */
export type LiveMode = 'lan' | 'landskap' | 'kommun' | 'stad' | 'ort' | 'sjo' | 'blandat';
export const LIVE_MODES: readonly LiveMode[] = ['lan', 'landskap', 'kommun', 'stad', 'ort', 'sjo', 'blandat'];

export function isLiveMode(value: unknown): value is LiveMode {
  return typeof value === 'string' && (LIVE_MODES as readonly string[]).includes(value);
}

/** Vilken sorts fråga det är. Blandat består av län- och residensstadsfrågor. */
export type LiveQuestionKind = Exclude<LiveMode, 'blandat'>;

/**
 * En fråga: `target` är länets, landskapets eller kommunens kod, länskoden för residensstaden,
 * stadens namn (Fler städer) eller sjöns id.
 */
export interface LiveQuestion {
  kind: LiveQuestionKind;
  target: string;
}

/** Frågor som besvaras med en punkt på kartan (inom ett avstånd) i stället för ett område. */
export function isPointKind(kind: LiveQuestionKind): kind is 'stad' | 'ort' {
  return kind === 'stad' || kind === 'ort';
}

export const LIVE_QUESTIONS = 10;
/** Tid att svara på en fråga. */
export const LIVE_QUESTION_MS = 12_000;
/** Hur länge rätt svar och ställningen visas innan nästa fråga. */
export const LIVE_REVEAL_MS = 5_000;
export const LIVE_MAX_PLAYERS = 12;
/** Ett rum utan aktivitet så här länge töms. */
export const LIVE_IDLE_MS = 2 * 60 * 60 * 1000;

/** Rätt svar ger 5–10 poäng: 10 för ett svar direkt, ned till 5 för ett svar i sista stund. */
export const LIVE_MAX_POINTS = 10;
export const LIVE_MIN_POINTS = 5;

export function livePoints(elapsedMs: number): number {
  const share = Math.min(Math.max(elapsedMs / LIVE_QUESTION_MS, 0), 1);
  return Math.round(LIVE_MAX_POINTS - (LIVE_MAX_POINTS - LIVE_MIN_POINTS) * share);
}

export type LivePhase = 'lobby' | 'question' | 'reveal' | 'done';

export interface LivePlayer {
  id: string;
  name: string;
  score: number;
  /** Har minst en öppen anslutning just nu. */
  connected: boolean;
  /** Har svarat på den pågående frågan. */
  answered: boolean;
}

/** En spelares svar på en fråga, som det visas när rätt svar avslöjas. */
export interface LiveAnswer {
  playerId: string;
  /** Området eller sjön spelaren klickade på, eller null (tiden tog slut, eller ett klick på en punkt). */
  code: string | null;
  /** Klicket, för städerna (och för ett klick på land i sjöläget). */
  lat?: number;
  lon?: number;
  /** Avståndet till staden i km, avrundat, för städerna. */
  distanceKm?: number;
  correct: boolean;
  points: number;
}

export interface LiveState {
  code: string;
  mode: LiveMode;
  phase: LivePhase;
  /** Den som kan starta matchen. Går vidare till nästa anslutna spelare om värden lämnar. */
  hostId: string | null;
  /** Mottagarens eget spelar-id. */
  you: string;
  players: LivePlayer[];
  /** Frågan som pågår eller just avslöjats. */
  question?: {
    /** 0-baserat. */
    index: number;
    total: number;
    kind: LiveQuestionKind;
    /** Se LiveQuestion; spelet visar namnet. */
    target: string;
    /** När frågan (phase "question") eller visningen (phase "reveal") tar slut, i serverns klocka (ms). */
    endsAt: number;
  };
  /** Alla svar på frågan, bara när den avslöjas (phase "reveal"). */
  answers?: LiveAnswer[];
  /** Serverns klocka när meddelandet skickades, så att klienten kan räkna om endsAt. */
  serverNow: number;
}

export type LiveClientMessage =
  | { type: 'start' }
  /** Ett område eller en sjö (`code`), eller en punkt på kartan (`lat`, `lon`). */
  | { type: 'answer'; question: number; code?: string; lat?: number; lon?: number }
  | { type: 'mode'; mode: LiveMode }
  | { type: 'lobby' };

export type LiveServerMessage = { type: 'state'; state: LiveState } | { type: 'error'; message: string; fatal: boolean };

export interface LiveCreateResponse {
  code: string;
}

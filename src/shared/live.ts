/**
 * Live-läget: regler, konstanter och meddelanden mellan spelet (src/) och rummen i Worker-scriptet
 * (worker/live.ts). Ett rum är ett Durable Object; spelarna är anslutna med WebSocket och servern
 * skickar hela rummets läge efter varje ändring.
 */

/** Rumskoder: fyra tecken utan sådana som är lätta att blanda ihop (0/O, 1/I/L). */
export const LIVE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LIVE_CODE_LENGTH = 4;
export const LIVE_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

/** Live-lägen. Börjar med Län; fler kan läggas till här och i rummets frågor. */
export type LiveMode = 'lan';
export const LIVE_MODES: readonly LiveMode[] = ['lan'];

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
  /** Länet spelaren klickade på, eller null om tiden tog slut. */
  code: string | null;
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
    /** Länets kod; spelet visar namnet. */
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
  | { type: 'answer'; question: number; code: string }
  | { type: 'lobby' };

export type LiveServerMessage = { type: 'state'; state: LiveState } | { type: 'error'; message: string; fatal: boolean };

export interface LiveCreateResponse {
  code: string;
}

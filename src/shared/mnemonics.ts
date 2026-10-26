/** API:t för minnesreglerna (PO-33), delat mellan spelet och servern. */

/** Enhetens slumpade id. */
export const DEVICE_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
export const COMMENT_MAX_LENGTH = 500;
/** Minst så många röster, och fler 👎 än 👍, så markeras en regel som ifrågasatt; PO avgör. */
export const QUESTIONED_MIN_VOTES = 5;

export type Vote = 1 | -1;
export type SuggestionKind = 'rule' | 'wish';

export interface RuleStats {
  id: string;
  up: number;
  down: number;
  /** Svar på "Hjälpte minnesregeln?". */
  helpedYes: number;
  helpedNo: number;
  /** Minst QUESTIONED_MIN_VOTES röster och fler 👎 än 👍. */
  questioned: boolean;
}

export interface RuleComment {
  id: number;
  ruleId: string;
  name: string | null;
  text: string;
  createdAt: string;
}

export interface RuleSuggestion {
  id: number;
  kind: SuggestionKind;
  name: string | null;
  text: string;
  createdAt: string;
}

/** GET /api/mnemonics?device=… */
export interface MnemonicsResponse {
  rules: RuleStats[];
  comments: RuleComment[];
  suggestions: RuleSuggestion[];
  /** Enhetens egna röster, om `device` angavs. */
  mine: Record<string, Vote>;
}

/** POST /api/mnemonics/vote: `vote` 0 tar tillbaka rösten. */
export interface VoteRequest {
  device: string;
  ruleId: string;
  vote: Vote | 0;
}

/** POST /api/mnemonics/helped */
export interface HelpedRequest {
  device: string;
  ruleId: string;
  helped: boolean;
}

/** POST /api/mnemonics/comment */
export interface CommentRequest {
  device: string;
  ruleId: string;
  name?: string;
  text: string;
}

/** POST /api/mnemonics/suggest */
export interface SuggestRequest {
  device: string;
  kind: SuggestionKind;
  name?: string;
  text: string;
}

/** Fri text från en spelare: utan styrtecken, med enkla mellanslag, högst `max` tecken. */
export function normalizeText(raw: unknown, max = COMMENT_MAX_LENGTH): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(cleaned).slice(0, max).join('').trim();
  return chars.length > 0 ? chars : null;
}

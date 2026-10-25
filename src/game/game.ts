import { COUNTIES, type County } from '../data/counties';
import { CONFIG, defaultScoring, type ScoringFn } from './config';
import { haversineKm, shuffle } from './geo';

export type Mode = 'lan' | 'stad' | 'blandat';
export type QuestionKind = 'lan' | 'stad';

export const MODE_LABELS: Record<Mode, string> = {
  lan: 'Län',
  stad: 'Residensstad',
  blandat: 'Blandat',
};

export interface Question {
  kind: QuestionKind;
  county: County;
}

export interface QuestionResult {
  question: Question;
  points: number;
  attempts: number;
  solved: boolean;
}

/** Ett svar från spelaren: antingen ett klickat län eller en klickad punkt. */
export type Guess =
  | { kind: 'county'; code: string | null }
  | { kind: 'point'; lat: number; lon: number };

export interface AnswerOutcome {
  correct: boolean;
  /** 0-baserat försöksindex som just användes. */
  attempt: number;
  attemptsLeft: number;
  pointsAwarded: number;
  /** Frågan är avslutad (rätt svar eller slut på försök). */
  finished: boolean;
  /** Avstånd i km till staden (bara i stadsläget). */
  distanceKm?: number;
}

export interface Summary {
  mode: Mode;
  score: number;
  maxScore: number;
  total: number;
  solved: number;
  firstTry: number;
  percentSolved: number;
  results: QuestionResult[];
}

export class Game {
  readonly mode: Mode;
  readonly questions: readonly Question[];
  readonly results: QuestionResult[] = [];
  private index = 0;
  private attempt = 0;
  private questionStartedAt = performance.now();
  private readonly scoring: ScoringFn;
  score = 0;

  constructor(mode: Mode, scoring: ScoringFn = defaultScoring, order: readonly County[] = shuffle(COUNTIES)) {
    this.mode = mode;
    this.scoring = scoring;
    this.questions = order.map((county) => ({ kind: pickKind(mode), county }));
  }

  get current(): Question | null {
    return this.questions[this.index] ?? null;
  }

  get total(): number {
    return this.questions.length;
  }

  /** 1-baserat nummer på aktuell fråga (för "7/21"). */
  get number(): number {
    return Math.min(this.index + 1, this.total);
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  get finished(): boolean {
    return this.index >= this.total;
  }

  /** Formulerar frågetexten. */
  prompt(): string {
    const q = this.current;
    if (!q) return '';
    return q.kind === 'lan' ? `Var ligger ${q.county.name}?` : `Var ligger ${q.county.city}?`;
  }

  answer(guess: Guess): AnswerOutcome {
    const q = this.current;
    if (!q) throw new Error('Spelet är slut');
    const attempt = this.attempt;
    let correct = false;
    let distanceKm: number | undefined;

    if (q.kind === 'lan') {
      correct = guess.kind === 'county' && guess.code === q.county.code;
    } else if (guess.kind === 'point') {
      distanceKm = haversineKm(guess.lat, guess.lon, q.county.lat, q.county.lon);
      correct = distanceKm <= CONFIG.cityRadiusKm;
    }

    const pointsAwarded = this.scoring({
      attempt,
      correct,
      elapsedMs: performance.now() - this.questionStartedAt,
    });
    this.attempt += 1;
    const finished = correct || this.attempt >= CONFIG.maxAttempts;

    if (finished) {
      this.score += pointsAwarded;
      this.results.push({ question: q, points: pointsAwarded, attempts: this.attempt, solved: correct });
    }

    return {
      correct,
      attempt,
      attemptsLeft: Math.max(0, CONFIG.maxAttempts - this.attempt),
      pointsAwarded,
      finished,
      distanceKm,
    };
  }

  /** Går vidare till nästa fråga. Returnerar false om omgången är slut. */
  next(): boolean {
    this.index += 1;
    this.attempt = 0;
    this.questionStartedAt = performance.now();
    return !this.finished;
  }

  summary(): Summary {
    const maxPer = Math.max(...CONFIG.pointsByAttempt);
    const solved = this.results.filter((r) => r.solved).length;
    const firstTry = this.results.filter((r) => r.solved && r.attempts === 1).length;
    return {
      mode: this.mode,
      score: this.score,
      maxScore: maxPer * this.total,
      total: this.total,
      solved,
      firstTry,
      percentSolved: this.total ? Math.round((100 * solved) / this.total) : 0,
      results: this.results.slice(),
    };
  }
}

function pickKind(mode: Mode): QuestionKind {
  if (mode === 'blandat') return Math.random() < 0.5 ? 'lan' : 'stad';
  return mode;
}

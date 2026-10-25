import { COUNTIES, type County } from '../data/counties';
import { LAKES, type Lake } from '../data/lakes';
import { CONFIG, defaultScoring, type ScoringFn } from './config';
import { haversineKm, shuffle } from './geo';

export type Mode = 'lan' | 'stad' | 'sjo' | 'blandat';

export const MODE_LABELS: Record<Mode, string> = {
  lan: 'Län',
  stad: 'Residensstad',
  sjo: 'Sjöar',
  blandat: 'Blandat',
};

export type Question =
  | { kind: 'lan' | 'stad'; county: County }
  | { kind: 'sjo'; lake: Lake };

export type QuestionKind = Question['kind'];

export interface QuestionResult {
  question: Question;
  points: number;
  attempts: number;
  solved: boolean;
}

/** Ett svar från spelaren: ett klickat län, en klickad sjö eller en klickad punkt. */
export type Guess =
  | { kind: 'county'; code: string | null }
  | { kind: 'lake'; id: string | null }
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

  constructor(mode: Mode, scoring: ScoringFn = defaultScoring, questions: readonly Question[] = buildQuestions(mode)) {
    this.mode = mode;
    this.scoring = scoring;
    this.questions = questions;
  }

  get current(): Question | null {
    return this.questions[this.index] ?? null;
  }

  get total(): number {
    return this.questions.length;
  }

  /** 1-baserat nummer på aktuell fråga (för "7/21" eller "3/10"). */
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
    return q ? `Var ligger ${questionLabel(q)}?` : '';
  }

  answer(guess: Guess): AnswerOutcome {
    const q = this.current;
    if (!q) throw new Error('Spelet är slut');
    const attempt = this.attempt;
    let correct = false;
    let distanceKm: number | undefined;

    if (q.kind === 'lan') {
      correct = guess.kind === 'county' && guess.code === q.county.code;
    } else if (q.kind === 'sjo') {
      correct = guess.kind === 'lake' && guess.id === q.lake.id;
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

/** Frågorna för en omgång i slumpad ordning: alla 21 län, eller alla sjöar i sjöläget. */
export function buildQuestions(mode: Mode): Question[] {
  if (mode === 'sjo') return shuffle(LAKES).map((lake) => ({ kind: 'sjo', lake }));
  return shuffle(COUNTIES).map((county) => ({ kind: pickCountyKind(mode), county }));
}

function pickCountyKind(mode: Exclude<Mode, 'sjo'>): 'lan' | 'stad' {
  if (mode === 'blandat') return Math.random() < 0.5 ? 'lan' : 'stad';
  return mode;
}

/** Det frågan gäller: länets namn, stadens namn eller sjöns namn. */
export function questionLabel(q: Question): string {
  if (q.kind === 'sjo') return q.lake.name;
  return q.kind === 'lan' ? q.county.name : q.county.city;
}

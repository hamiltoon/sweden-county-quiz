import type { Mode } from './game';

const KEY = 'sverigespelet.best.v1';

export interface BestResult {
  score: number;
  percent: number;
  date: string;
}

type BestMap = Partial<Record<Mode, BestResult>>;

function readAll(): BestMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BestMap) : {};
  } catch {
    return {};
  }
}

export function getBest(mode: Mode): BestResult | undefined {
  return readAll()[mode];
}

/** Sparar resultatet om det är bättre än tidigare. Returnerar true om nytt rekord. */
export function saveBest(mode: Mode, result: BestResult): boolean {
  const all = readAll();
  const prev = all[mode];
  if (prev && prev.score >= result.score) return false;
  all[mode] = result;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* privat läge etc. – ignorera */
  }
  return true;
}

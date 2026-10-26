/** Spelinställningar – samlade på ett ställe så de är lätta att ändra. */
export const CONFIG = {
  /** Max antal försök per fråga innan rätt svar visas. */
  maxAttempts: 3,
  /** Poäng per försök: index 0 = rätt på första försöket. */
  pointsByAttempt: [3, 2, 1] as readonly number[],
  /** Hur nära (km) klicket måste vara staden, både residensstäderna och "Fler städer". */
  cityRadiusKm: 30,
  /** Antal kommuner per omgång i kommunläget (slumpas bland alla 290). */
  municipalitiesPerRound: 20,
  /** Antal städer per omgång i läget "Fler städer" (slumpas ur hela listan). */
  otherCitiesPerRound: 20,
  /** Hur länge (ms) rätt svar visas efter en fråga innan nästa. */
  revealMs: 1500,
  /** Efter en missad fråga zoomar kartan in på rätt svar, så det får visas lite längre. */
  revealMissMs: 2400,
  /** PO-15 (variant b och c): nedräkningen efter en missad fråga innan spelet går vidare av sig självt. */
  revealMissAutoMs: 4000,
  /** PO-15: zoomen som visar felklicket och rätt svar tillsammans. */
  revealFitMs: 600,
  /**
   * Färga län och sjöar efter hur frågan gick, redan under omgången. Obs: det gör de sista
   * frågorna lättare, eftersom man kan räkna ut svaret genom uteslutning. Stäng av med false;
   * kartsammanfattningen på slutskärmen visas ändå.
   */
  fillMapDuringRound: true,
  /** Hur länge (ms) en kort feedback-toast visas. */
  toastMs: 1200,
  /** Klick tätare än så här (ms) ignoreras, så ett dubbeltryck inte kostar två försök. */
  doubleTapGuardMs: 300,
};

/**
 * Poängsystemet är utbytbart: ersätt funktionen för att t.ex. basera poängen på tid.
 * `attempt` är 0-baserat (0 = första försöket). `correct` anger om försöket var rätt.
 */
export type ScoringFn = (ctx: { attempt: number; correct: boolean; elapsedMs: number }) => number;

export const defaultScoring: ScoringFn = ({ attempt, correct }) =>
  correct ? (CONFIG.pointsByAttempt[attempt] ?? 0) : 0;

export const maxPointsPerQuestion = (): number => Math.max(...CONFIG.pointsByAttempt);

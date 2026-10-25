import './style.css';
import type { Topology } from 'topojson-specification';
import { Game, MODE_LABELS, type AnswerOutcome, type Mode, type Question, type Summary } from './game/game';
import { CONFIG } from './game/config';
import { distanceToShapeKm } from './game/geo';
import { LAKE_BY_ID, lakeRankText } from './data/lakes';
import { saveBest } from './game/storage';
import { SwedenMap, type MapClick, type ResultState } from './map/map';
import { renderMiniMap } from './map/minimap';
import { el, clear } from './ui/dom';
import { Toast } from './ui/toast';
import { renderEnd, renderRecapLegend, renderStart } from './ui/screens';
import { renderEndLeaderboard, renderStartLeaderboard } from './ui/leaderboard';
import { newResultId } from './api/leaderboard';
import { registerServiceWorker } from './pwa';

const screen = document.getElementById('screen') as HTMLElement;
const topologyPromises = new Map<string, Promise<Topology>>();

/** Hämtar en kartfil en gång; ett misslyckat försök glöms så att nästa omgång försöker igen. */
function loadTopology(url: string): Promise<Topology> {
  let promise = topologyPromises.get(url);
  if (!promise) {
    promise = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Kunde inte läsa kartdata ${url} (${r.status})`);
      return r.json() as Promise<Topology>;
    });
    promise.catch(() => topologyPromises.delete(url));
    topologyPromises.set(url, promise);
  }
  return promise;
}

const COUNTIES_URL = '/data/lan.topo.json';
const LAKES_URL = '/data/sjoar.topo.json';
const NEIGHBORS_URL = '/data/grannar.topo.json';

/** Hämtar en kartfil som bara är dekoration; utan den visas kartan ändå. */
function loadOptional(url: string): Promise<Topology | null> {
  return loadTopology(url).catch((err: unknown) => {
    console.warn(err);
    return null;
  });
}

function showStart(): void {
  clear(screen);
  screen.className = 'screen screen-start';
  const brandMap = el('div', { class: 'brand-map' });
  screen.append(renderStart((mode) => void showGame(mode), renderStartLeaderboard(), brandMap));
  screen.append(renderFooter());
  // Förladda kartan i bakgrunden och rita en liten Sverigekarta bredvid rubriken när den finns.
  void Promise.all([loadTopology(COUNTIES_URL), loadOptional(LAKES_URL)])
    .then(([counties, lakes]) => brandMap.append(renderMiniMap({ counties, lakes, width: 46, height: 100 })))
    .catch(() => undefined);
  void loadOptional(NEIGHBORS_URL);
}

function renderFooter(): HTMLElement {
  return el(
    'footer',
    { class: 'footer' },
    'Kartdata: ',
    el('a', { href: 'https://www.naturalearthdata.com/', target: '_blank', rel: 'noopener' }, 'Natural Earth'),
    ' (public domain) · ',
    el('a', { href: 'https://github.com/hamiltoon/sweden-county-quiz', target: '_blank', rel: 'noopener' }, 'Källkod'),
  );
}

async function showGame(mode: Mode): Promise<void> {
  clear(screen);
  screen.className = 'screen screen-game';

  const hud = el('header', { class: 'hud' });
  const question = el('h2', { class: 'question', 'aria-live': 'polite' }, 'Laddar kartan…');
  const progress = el('span', { class: 'hud-progress' }, '');
  const score = el('span', { class: 'hud-score' }, '');
  const quit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Avsluta omgången', title: 'Avsluta' }, '✕');
  hud.append(
    el('div', { class: 'hud-row' }, el('span', { class: 'hud-mode' }, MODE_LABELS[mode]), progress, score, quit),
    question,
  );

  const mapWrap = el('div', { class: 'map-wrap' });
  const mapEl = el('div', { class: 'map', id: 'map' });
  const zoomCtrls = el('div', { class: 'zoom-ctrls' });
  const zoomIn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zooma in' }, '+');
  const zoomOut = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zooma ut' }, '−');
  const zoomReset = el('button', { class: 'icon-btn zoom-reset', type: 'button', 'aria-label': 'Återställ zoom', title: 'Återställ' }, '⟲');
  zoomCtrls.append(zoomIn, zoomOut, zoomReset);
  mapWrap.append(mapEl, zoomCtrls);
  screen.append(hud, mapWrap);
  const lakeMode = mode === 'sjo';
  // Sjöarna längst norrut (Torneträsk, Akkajaure) ligger där toasten annars hamnar.
  const toast = new Toast(mapWrap, lakeMode ? 'bottom' : 'top');

  let topology: Topology;
  let lakes: Topology | null = null;
  let neighbors: Topology | null = null;
  try {
    // Sjöarna krävs i sjöläget. I övriga lägen är de bara riktmärken, och grannländerna är alltid
    // bara bakgrund, så kartan visas utan dem om de inte går att hämta.
    const lakesPromise = lakeMode ? loadTopology(LAKES_URL) : loadOptional(LAKES_URL);
    [topology, lakes, neighbors] = await Promise.all([loadTopology(COUNTIES_URL), lakesPromise, loadOptional(NEIGHBORS_URL)]);
  } catch (err) {
    question.textContent = 'Kartan kunde inte laddas. Kontrollera uppkopplingen och försök igen.';
    console.error(err);
    quit.addEventListener('click', showStart);
    return;
  }

  const map = new SwedenMap(mapEl, topology, { lakes, neighbors, lakeMode });
  const game = new Game(mode);
  let locked = false;
  let timer: number | undefined;
  let lastClickAt = 0;

  const updateHud = () => {
    progress.textContent = `${game.number}/${game.total}`;
    score.textContent = `${game.score} p`;
    question.textContent = game.prompt();
  };

  const finishRound = () => {
    map.destroy();
    const summary = game.summary();
    // Samma id i rekordet och på topplistan, så att rekordet inte sparas två gånger om det
    // senare laddas upp som ett tidigare resultat.
    const result = {
      id: newResultId(),
      mode,
      score: summary.score,
      percent: summary.percentSolved,
      playedAt: new Date().toISOString(),
    };
    const isNewBest = saveBest(mode, { score: result.score, percent: result.percent, date: result.playedAt, id: result.id });
    clear(screen);
    screen.className = 'screen screen-end';
    screen.append(
      renderEnd(summary, isNewBest, () => void showGame(mode), showStart, {
        leaderboard: renderEndLeaderboard(mode, result),
        recap: renderRecap(summary, topology, lakes),
      }),
      renderFooter(),
    );
  };

  /** Färgar länet eller sjön efter hur frågan gick, så att kartan fylls under omgången. */
  const markResult = (q: Question, outcome: AnswerOutcome) => {
    if (!CONFIG.fillMapDuringRound || !outcome.finished) return;
    const state: ResultState = outcome.correct ? (outcome.attempt === 0 ? 'first' : 'later') : 'missed';
    if (q.kind === 'sjo') map.setLakeResult(q.lake.id, state);
    else map.setCountyResult(q.county.code, state);
  };

  const nextQuestion = () => {
    map.clearHighlights();
    map.clearMarkers();
    toast.hide();
    if (!game.next()) {
      finishRound();
      return;
    }
    if (map.isTransformed) map.resetZoom();
    updateHud();
    locked = false;
    map.setInteractive(true);
  };

  const revealAndContinue = (message: string, kind: 'ok' | 'bad', ms: number = CONFIG.revealMs) => {
    locked = true;
    map.setInteractive(false);
    toast.show(message, kind, 0);
    timer = window.setTimeout(nextQuestion, ms);
  };

  map.onClick = (click: MapClick) => {
    if (locked) return;
    // Oavsiktliga dubbeltryck ska inte kosta två försök.
    const now = performance.now();
    if (now - lastClickAt < CONFIG.doubleTapGuardMs) return;
    lastClickAt = now;
    const q = game.current;
    if (!q) return;

    if (q.kind === 'sjo') {
      const target = q.lake;
      const outcome = game.answer({ kind: 'lake', id: click.lake });
      markResult(q, outcome);
      const clicked = click.lake ? LAKE_BY_ID.get(click.lake) : undefined;
      // Vid miss: säg vilken sjö det var, eller hur långt bort från rätt sjö klicket hamnade.
      const missText = () => {
        if (clicked) return `Fel, det var ${clicked.name}.`;
        const shape = map.lakeGeometry(target.id);
        const km = shape ? Math.round(distanceToShapeKm(shape, click.lat, click.lon)) : null;
        return km === null ? 'Fel.' : `Fel – ${km} km bort.`;
      };
      if (outcome.correct) {
        map.highlightLake(target.id, 'correct');
        map.showLakeLabel(target.id);
        revealAndContinue(`Rätt! ${lakeRankText(target)} · +${outcome.pointsAwarded} p`, 'ok');
      } else if (outcome.finished) {
        if (clicked) map.highlightLake(clicked.id, 'wrong');
        else map.addMarker(click.lon, click.lat, 'wrong');
        map.highlightLake(target.id, 'reveal');
        map.showLakeLabel(target.id);
        map.focusLake(target.id);
        revealAndContinue(`${missText()} Här ligger ${target.name}.`, 'bad', CONFIG.revealMissMs);
      } else {
        if (clicked) {
          map.highlightLake(clicked.id, 'wrong');
          // Ta inte bort markeringen om frågan hunnit avslutas; då ska felklicket synas med svaret.
          window.setTimeout(() => !locked && map.unhighlightLake(clicked.id, 'wrong'), CONFIG.toastMs);
        } else {
          map.addMarker(click.lon, click.lat, 'wrong');
        }
        toast.show(`${missText()} ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    } else if (q.kind === 'lan') {
      if (!click.code) {
        toast.show('Klicka på ett län', 'info', CONFIG.toastMs);
        return;
      }
      const outcome = game.answer({ kind: 'county', code: click.code });
      markResult(q, outcome);
      if (outcome.correct) {
        map.highlight(click.code, 'correct');
        revealAndContinue(`Rätt! +${outcome.pointsAwarded} p`, 'ok');
      } else if (outcome.finished) {
        map.highlight(click.code, 'wrong');
        map.highlight(q.county.code, 'reveal');
        map.focusCounty(q.county.code);
        revealAndContinue(`Fel – det var ${countyLabel(click.code, topology)}. Här är ${q.county.name}.`, 'bad', CONFIG.revealMissMs);
      } else {
        map.highlight(click.code, 'wrong');
        // Ta inte bort markeringen om frågan hunnit avslutas; då ska felklicket synas med svaret.
        window.setTimeout(() => !locked && map.unhighlight(click.code!, 'wrong'), CONFIG.toastMs);
        toast.show(`Fel, det var ${countyLabel(click.code, topology)}. ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    } else {
      const outcome = game.answer({ kind: 'point', lat: click.lat, lon: click.lon });
      markResult(q, outcome);
      const km = Math.round(outcome.distanceKm ?? 0);
      if (outcome.correct) {
        map.addMarker(click.lon, click.lat, 'correct');
        map.addMarker(q.county.lon, q.county.lat, 'reveal', q.county.city);
        revealAndContinue(`Rätt! ${km} km från ${q.county.city} · +${outcome.pointsAwarded} p`, 'ok');
      } else if (outcome.finished) {
        map.addMarker(click.lon, click.lat, 'wrong');
        map.addMarker(q.county.lon, q.county.lat, 'reveal', q.county.city);
        map.focusPoint(q.county.lon, q.county.lat);
        revealAndContinue(`Fel – ${km} km bort. Här ligger ${q.county.city}.`, 'bad', CONFIG.revealMissMs);
      } else {
        map.addMarker(click.lon, click.lat, 'wrong');
        toast.show(`${km} km bort. ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    }
    score.textContent = `${game.score} p`;
  };

  zoomIn.addEventListener('click', () => map.zoomBy(1.6));
  zoomOut.addEventListener('click', () => map.zoomBy(1 / 1.6));
  zoomReset.addEventListener('click', () => map.resetZoom());
  quit.addEventListener('click', () => {
    window.clearTimeout(timer);
    map.destroy();
    showStart();
  });

  updateHud();
}

/** Minikarta färgad efter hur varje fråga gick, med förklaring och antal. */
function renderRecap(summary: Summary, counties: Topology, lakes: Topology | null): HTMLElement {
  const countyResults = new Map<string, ResultState>();
  const lakeResults = new Map<string, ResultState>();
  const counts = { first: 0, later: 0, missed: 0 };
  for (const r of summary.results) {
    const state: ResultState = r.solved ? (r.attempts === 1 ? 'first' : 'later') : 'missed';
    counts[state] += 1;
    if (r.question.kind === 'sjo') lakeResults.set(r.question.lake.id, state);
    else countyResults.set(r.question.county.code, state);
  }
  const map = renderMiniMap({
    counties,
    lakes,
    width: 104,
    height: 210,
    countyResults,
    lakeResults,
    className: 'recap-map',
    label: `Karta över omgången: ${counts.first} rätt direkt, ${counts.later} efter fler försök, ${counts.missed} missade.`,
  });
  return el('div', { class: 'recap' }, map, renderRecapLegend(counts));
}

function attemptsText(left: number): string {
  return left === 1 ? 'Sista försöket!' : `${left} försök kvar.`;
}

function countyLabel(code: string, topology: Topology): string {
  const obj = topology.objects.lan as { geometries: { properties?: { code: string; name: string } }[] };
  return obj.geometries.find((g) => g.properties?.code === code)?.properties?.name ?? code;
}

showStart();
registerServiceWorker();

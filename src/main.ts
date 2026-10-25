import './style.css';
import type { Topology } from 'topojson-specification';
import { Game, modeLabel, type AnswerOutcome, type Mode, type Question, type Summary } from './game/game';
import { CONFIG } from './game/config';
import { distanceToShapeKm } from './game/geo';
import { LAKE_BY_ID } from './data/lakes';
import { COUNTY_BY_CODE } from './data/counties';
import { PROVINCE_BY_CODE } from './data/provinces';
import { MUNICIPALITY_BY_CODE } from './data/municipalities';
import { getCurrentLiveRoom, getLiveName, getLivePlayerId, saveBest, saveLiveName, setCurrentLiveRoom } from './game/storage';
import { SwedenMap, type MapClick, type ResultState } from './map/map';
import { renderMiniMap } from './map/minimap';
import { regionSteps } from './map/adjacency';
import { COUNTIES_URL, LAKES_URL, NEIGHBORS_URL, regionsFor } from './map/sources';
import { el, clear } from './ui/dom';
import { Toast } from './ui/toast';
import { renderEnd, renderRecapLegend, renderStart } from './ui/screens';
import { renderEndLeaderboard, renderStartLeaderboard } from './ui/leaderboard';
import { newResultId } from './api/leaderboard';
import { registerServiceWorker } from './pwa';
import { createRoom, LiveConnection } from './live/connection';
import { renderLiveEntry } from './live/entry';
import { LiveView, type LiveMaps } from './live/view';
import type { LiveQuestionKind } from './shared/live';
import { applyToDocument, countyName, municipalityName, onLangChange, provinceName, t } from './i18n';
import { adoptAccountLanguage } from './api/account';

const screen = document.getElementById('screen') as HTMLElement;
const topologyPromises = new Map<string, Promise<Topology>>();

/** Hämtar en kartfil en gång; ett misslyckat försök glöms så att nästa omgång försöker igen. */
function loadTopology(url: string): Promise<Topology> {
  let promise = topologyPromises.get(url);
  if (!promise) {
    promise = fetch(url).then((r) => {
      if (!r.ok) throw new Error(t().common.mapDataFailed(url, r.status));
      return r.json() as Promise<Topology>;
    });
    promise.catch(() => topologyPromises.delete(url));
    topologyPromises.set(url, promise);
  }
  return promise;
}

/** Svar norr om den här breddgraden hamnar under toasten om den ligger överst. */
const NORTH_TOAST_LAT = 64.5;


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
  screen.append(renderStart((mode) => void showGame(mode), renderStartLeaderboard(), brandMap, () => showLive()));
  screen.append(renderFooter());
  // Förladda kartan i bakgrunden och rita en liten Sverigekarta bredvid rubriken när den finns.
  void Promise.all([loadTopology(COUNTIES_URL), loadOptional(LAKES_URL)])
    .then(([counties, lakes]) => brandMap.append(renderMiniMap({ counties, lakes, width: 46, height: 100 })))
    .catch(() => undefined);
  void loadOptional(NEIGHBORS_URL);
}

/** Sökvägen för en delad länk till ett live-rum, t.ex. /live/KXR4. */
const LIVE_PATH = /^\/live\/([A-Za-z0-9]{4})\/?$/;

function goHome(): void {
  setCurrentLiveRoom(null);
  if (location.pathname !== '/') history.replaceState(null, '', '/');
  showStart();
}

/** Live-lägets första skärm: skapa ett rum eller gå med (med koden förifylld från en länk). */
function showLive(code?: string): void {
  const name = getLiveName();
  // Omladdning mitt i en match: tillbaka in i samma rum direkt.
  if (code && name && getCurrentLiveRoom() === code) {
    joinLive(code, name);
    return;
  }
  clear(screen);
  screen.className = 'screen screen-end';
  screen.append(
    renderLiveEntry({
      code,
      name,
      onCreate: async (name) => joinLive(await createRoom(), name),
      onJoin: joinLive,
      onBack: goHome,
    }),
    renderFooter(),
  );
}

/** Kartan för en sorts livefråga (samma kartor som det vanliga spelet). */
async function loadLiveMaps(kind: LiveQuestionKind): Promise<LiveMaps> {
  const source = regionsFor(kind);
  const lakeMode = kind === 'sjo';
  const [regions, lakes, neighbors] = await Promise.all([
    loadTopology(source.url),
    lakeMode ? loadTopology(LAKES_URL) : loadOptional(LAKES_URL),
    loadOptional(NEIGHBORS_URL),
  ]);
  return {
    regions,
    objectName: source.objectName,
    groupBy: source.groupBy,
    lakes,
    neighbors,
    lakeMode,
    steps: kind === 'kommun' ? regionSteps(regions, source.objectName) : null,
  };
}

function joinLive(code: string, name: string): void {
  saveLiveName(name);
  setCurrentLiveRoom(code);
  // Adressen blir rummets länk, så att en omladdning går tillbaka in i rummet.
  history.replaceState(null, '', `/live/${code}`);
  let conn: LiveConnection | null = null;
  const view = new LiveView(screen, () => conn, loadLiveMaps, () => {
    conn?.close();
    view.destroy();
    goHome();
  });
  clear(screen);
  screen.className = 'screen screen-end';
  screen.append(el('section', { class: 'end' }, el('h2', {}, t().live.connecting(code))));
  conn = new LiveConnection(code, getLivePlayerId(), name, {
    onState: (state) => view.render(state),
    onError: (message, fatal) => (fatal ? view.showError(message) : view.notify(message)),
    onReconnecting: (reconnecting) => view.setBanner(reconnecting ? t().live.reconnecting : ''),
  });
}

function renderFooter(): HTMLElement {
  return el(
    'footer',
    { class: 'footer' },
    t().footer.mapData,
    el('a', { href: 'https://www.naturalearthdata.com/', target: '_blank', rel: 'noopener' }, 'Natural Earth'),
    t().footer.landskap,
    el('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, 'OpenStreetMap'),
    ' · ',
    el('a', { href: 'https://github.com/hamiltoon/sweden-county-quiz', target: '_blank', rel: 'noopener' }, t().footer.source),
  );
}

async function showGame(mode: Mode): Promise<void> {
  clear(screen);
  screen.className = 'screen screen-game';

  const hud = el('header', { class: 'hud' });
  const question = el('h2', { class: 'question', 'aria-live': 'polite' }, t().game.loadingMap);
  const progress = el('span', { class: 'hud-progress' }, '');
  const score = el('span', { class: 'hud-score' }, '');
  const quit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t().game.quit, title: t().game.quitTitle }, '✕');
  hud.append(
    el('div', { class: 'hud-row' }, el('span', { class: 'hud-mode' }, modeLabel(mode)), progress, score, quit),
    question,
  );

  const mapWrap = el('div', { class: 'map-wrap' });
  const mapEl = el('div', { class: 'map', id: 'map' });
  const zoomCtrls = el('div', { class: 'zoom-ctrls' });
  const zoomIn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t().game.zoomIn }, '+');
  const zoomOut = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t().game.zoomOut }, '−');
  const zoomReset = el('button', { class: 'icon-btn zoom-reset', type: 'button', 'aria-label': t().game.zoomReset, title: t().game.zoomResetTitle }, '⟲');
  zoomCtrls.append(zoomIn, zoomOut, zoomReset);
  mapWrap.append(mapEl, zoomCtrls);
  screen.append(hud, mapWrap);
  const lakeMode = mode === 'sjo';
  // Sjöarna längst norrut (Torneträsk, Akkajaure) ligger där toasten annars hamnar.
  const toast = new Toast(mapWrap, lakeMode ? 'bottom' : 'top');

  const regions = regionsFor(mode);
  let topology: Topology;
  let lakes: Topology | null = null;
  let neighbors: Topology | null = null;
  try {
    // Sjöarna krävs i sjöläget. I övriga lägen är de bara riktmärken, och grannländerna är alltid
    // bara bakgrund, så kartan visas utan dem om de inte går att hämta.
    const lakesPromise = lakeMode ? loadTopology(LAKES_URL) : loadOptional(LAKES_URL);
    [topology, lakes, neighbors] = await Promise.all([loadTopology(regions.url), lakesPromise, loadOptional(NEIGHBORS_URL)]);
  } catch (err) {
    question.textContent = t().common.mapFailed;
    console.error(err);
    quit.addEventListener('click', showStart);
    return;
  }

  const map = new SwedenMap(mapEl, topology, { objectName: regions.objectName, groupBy: regions.groupBy, lakes, neighbors, lakeMode });
  // Kommunläget: vid fel kommun säger vi hur många kommuner bort den var.
  const steps = mode === 'kommun' ? regionSteps(topology, regions.objectName) : null;
  const game = new Game(mode);
  let locked = false;
  let timer: number | undefined;
  let lastClickAt = 0;

  const updateHud = () => {
    progress.textContent = `${game.number}/${game.total}`;
    score.textContent = t().common.points(game.score);
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
        recap: renderRecap(summary, topology, regions.objectName, lakes),
      }),
      renderFooter(),
    );
  };

  /** Färgar länet eller sjön efter hur frågan gick, så att kartan fylls under omgången. */
  const markResult = (q: Question, outcome: AnswerOutcome) => {
    if (!CONFIG.fillMapDuringRound || !outcome.finished) return;
    const state: ResultState = outcome.correct ? (outcome.attempt === 0 ? 'first' : 'later') : 'missed';
    if (q.kind === 'sjo') map.setLakeResult(q.lake.id, state);
    // Flera av de andra städerna kan ligga i samma län, så de markeras med en prick i stället.
    else if (q.kind === 'ort') map.addResultDot(q.city.lon, q.city.lat, state);
    else if (q.kind === 'landskap') map.setCountyResult(q.province.code, state);
    else if (q.kind === 'kommun') map.setCountyResult(q.municipality.code, state);
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
        if (clicked) return t().game.wrongWas(clicked.name);
        const shape = map.lakeGeometry(target.id);
        const km = shape ? Math.round(distanceToShapeKm(shape, click.lat, click.lon)) : null;
        return km === null ? t().game.wrong : t().game.wrongKm(km);
      };
      if (outcome.correct) {
        map.highlightLake(target.id, 'correct');
        map.showLakeLabel(target.id);
        revealAndContinue(t().game.rightLake(t().game.lakeRank(target.rank), outcome.pointsAwarded), 'ok');
      } else if (outcome.finished) {
        if (clicked) map.highlightLake(clicked.id, 'wrong');
        else map.addMarker(click.lon, click.lat, 'wrong');
        map.highlightLake(target.id, 'reveal');
        map.showLakeLabel(target.id);
        map.focusLake(target.id);
        revealAndContinue(t().game.missReveal(missText(), target.name), 'bad', CONFIG.revealMissMs);
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
    } else if (q.kind === 'lan' || q.kind === 'landskap' || q.kind === 'kommun') {
      if (!click.code) {
        const hint = { lan: t().game.clickCounty, landskap: t().game.clickProvince, kommun: t().game.clickMunicipality }[q.kind];
        toast.show(hint, 'info', CONFIG.toastMs);
        return;
      }
      const target =
        q.kind === 'landskap'
          ? { code: q.province.code, name: provinceName(q.province) }
          : q.kind === 'kommun'
            ? { code: q.municipality.code, name: municipalityName(q.municipality) }
            : { code: q.county.code, name: countyName(q.county) };
      const outcome = game.answer({ kind: 'county', code: click.code });
      markResult(q, outcome);
      if (outcome.correct) {
        map.highlight(click.code, 'correct');
        revealAndContinue(t().game.right(outcome.pointsAwarded), 'ok');
      } else if (outcome.finished) {
        map.highlight(click.code, 'wrong');
        map.highlight(target.code, 'reveal');
        map.focusCounty(target.code);
        const away = steps?.(click.code, target.code);
        revealAndContinue(
          away ? t().game.wrongWasAwayReveal(regionName(click.code), t().game.municipalitiesAway(away), target.name) : t().game.wrongWasReveal(regionName(click.code), target.name),
          'bad',
          CONFIG.revealMissMs,
        );
      } else {
        map.highlight(click.code, 'wrong');
        // Ta inte bort markeringen om frågan hunnit avslutas; då ska felklicket synas med svaret.
        window.setTimeout(() => !locked && map.unhighlight(click.code!, 'wrong'), CONFIG.toastMs);
        const away = steps?.(click.code, target.code);
        const wrong = away ? t().game.wrongWasAway(regionName(click.code), t().game.municipalitiesAway(away)) : t().game.wrongWas(regionName(click.code));
        toast.show(`${wrong} ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    } else {
      // Residensstad eller en av de andra städerna: samma klick, olika mål.
      const target =
        q.kind === 'ort'
          ? { name: q.city.name, lat: q.city.lat, lon: q.city.lon }
          : { name: q.county.city, lat: q.county.lat, lon: q.county.lon };
      const outcome = game.answer({ kind: 'point', lat: click.lat, lon: click.lon });
      markResult(q, outcome);
      // Städer längst norrut (Kiruna, Gällivare, Luleå …) ligger där toasten annars hamnar.
      toast.setPlacement(target.lat > NORTH_TOAST_LAT ? 'bottom' : 'top');
      const km = Math.round(outcome.distanceKm ?? 0);
      if (outcome.correct) {
        map.addMarker(click.lon, click.lat, 'correct');
        map.addMarker(target.lon, target.lat, 'reveal', target.name);
        revealAndContinue(t().game.rightCity(km, target.name, outcome.pointsAwarded), 'ok');
      } else if (outcome.finished) {
        map.addMarker(click.lon, click.lat, 'wrong');
        map.addMarker(target.lon, target.lat, 'reveal', target.name);
        map.focusPoint(target.lon, target.lat);
        revealAndContinue(t().game.missReveal(t().game.wrongKm(km), target.name), 'bad', CONFIG.revealMissMs);
      } else {
        map.addMarker(click.lon, click.lat, 'wrong');
        toast.show(`${t().game.kmAway(km)} ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    }
    score.textContent = t().common.points(game.score);
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
function renderRecap(summary: Summary, regions: Topology, objectName: string, lakes: Topology | null): HTMLElement {
  const countyResults = new Map<string, ResultState>();
  const lakeResults = new Map<string, ResultState>();
  const points: { lon: number; lat: number; state: ResultState }[] = [];
  const counts = { first: 0, later: 0, missed: 0 };
  for (const r of summary.results) {
    const state: ResultState = r.solved ? (r.attempts === 1 ? 'first' : 'later') : 'missed';
    counts[state] += 1;
    if (r.question.kind === 'sjo') lakeResults.set(r.question.lake.id, state);
    else if (r.question.kind === 'ort') points.push({ lon: r.question.city.lon, lat: r.question.city.lat, state });
    else if (r.question.kind === 'landskap') countyResults.set(r.question.province.code, state);
    else if (r.question.kind === 'kommun') countyResults.set(r.question.municipality.code, state);
    else countyResults.set(r.question.county.code, state);
  }
  const map = renderMiniMap({
    counties: regions,
    objectName,
    lakes,
    width: 104,
    height: 210,
    countyResults,
    lakeResults,
    points,
    className: 'recap-map',
    label: t().game.recapLabel(counts.first, counts.later, counts.missed),
  });
  return el('div', { class: 'recap' }, map, renderRecapLegend(counts));
}

function attemptsText(left: number): string {
  return left === 1 ? t().game.lastAttempt : t().game.attemptsLeft(left);
}

/** Namnet på ett klickat län, landskap eller kommun (versaler, gemener respektive fyra siffror). */
function regionName(code: string): string {
  const county = COUNTY_BY_CODE.get(code);
  if (county) return countyName(county);
  const province = PROVINCE_BY_CODE.get(code);
  if (province) return provinceName(province);
  const municipality = MUNICIPALITY_BY_CODE.get(code);
  return municipality ? municipalityName(municipality) : code;
}

applyToDocument();
// Byter spelaren språk (på startskärmen, eller för att kontot har ett annat språk sparat) ritas
// startskärmen om på det nya språket.
onLangChange(() => {
  if (screen.classList.contains('screen-start')) showStart();
});
const liveLink = LIVE_PATH.exec(location.pathname);
if (liveLink) showLive(liveLink[1].toUpperCase());
else showStart();
void adoptAccountLanguage();
registerServiceWorker();

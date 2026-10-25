import './style.css';
import type { Topology } from 'topojson-specification';
import { Game, MODE_LABELS, type Mode } from './game/game';
import { CONFIG } from './game/config';
import { saveBest } from './game/storage';
import { SwedenMap, type MapClick } from './map/map';
import { el, clear } from './ui/dom';
import { Toast } from './ui/toast';
import { renderEnd, renderStart } from './ui/screens';
import { registerServiceWorker } from './pwa';

const screen = document.getElementById('screen') as HTMLElement;
let topologyPromise: Promise<Topology> | null = null;

function loadTopology(): Promise<Topology> {
  topologyPromise ??= fetch('/data/lan.topo.json').then((r) => {
    if (!r.ok) throw new Error(`Kunde inte läsa kartdata (${r.status})`);
    return r.json() as Promise<Topology>;
  });
  return topologyPromise;
}

function showStart(): void {
  clear(screen);
  screen.className = 'screen screen-start';
  screen.append(renderStart((mode) => void showGame(mode)));
  screen.append(renderFooter());
  void loadTopology().catch(() => undefined); // förladda kartan i bakgrunden
}

function renderFooter(): HTMLElement {
  return el(
    'footer',
    { class: 'footer' },
    'Kartdata: ',
    el('a', { href: 'https://www.naturalearthdata.com/', target: '_blank', rel: 'noopener' }, 'Natural Earth'),
    ' (public domain) · ',
    el('a', { href: 'https://github.com/hamiltoon/sverigespelet', target: '_blank', rel: 'noopener' }, 'Källkod'),
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
  const toast = new Toast(mapWrap);

  let topology: Topology;
  try {
    topology = await loadTopology();
  } catch (err) {
    question.textContent = 'Kartan kunde inte laddas. Kontrollera uppkopplingen och försök igen.';
    console.error(err);
    quit.addEventListener('click', showStart);
    return;
  }

  const map = new SwedenMap(mapEl, topology);
  const game = new Game(mode);
  let locked = false;
  let timer: number | undefined;

  const updateHud = () => {
    progress.textContent = `${game.number}/${game.total}`;
    score.textContent = `${game.score} p`;
    question.textContent = game.prompt();
  };

  const finishRound = () => {
    map.destroy();
    const summary = game.summary();
    const isNewBest = saveBest(mode, {
      score: summary.score,
      percent: summary.percentSolved,
      date: new Date().toISOString(),
    });
    clear(screen);
    screen.className = 'screen screen-end';
    screen.append(
      renderEnd(summary, isNewBest, () => void showGame(mode), showStart),
      renderFooter(),
    );
  };

  const nextQuestion = () => {
    map.clearHighlights();
    map.clearMarkers();
    toast.hide();
    if (!game.next()) {
      finishRound();
      return;
    }
    if (map.zoomLevel > 1.01) map.resetZoom();
    updateHud();
    locked = false;
    map.setInteractive(true);
  };

  const revealAndContinue = (message: string, kind: 'ok' | 'bad') => {
    locked = true;
    map.setInteractive(false);
    toast.show(message, kind, 0);
    timer = window.setTimeout(nextQuestion, CONFIG.revealMs);
  };

  map.onClick = (click: MapClick) => {
    if (locked) return;
    const q = game.current;
    if (!q) return;

    if (q.kind === 'lan') {
      if (!click.code) {
        toast.show('Klicka på ett län', 'info', CONFIG.toastMs);
        return;
      }
      const outcome = game.answer({ kind: 'county', code: click.code });
      if (outcome.correct) {
        map.highlight(click.code, 'correct');
        revealAndContinue(`Rätt! +${outcome.pointsAwarded} p`, 'ok');
      } else if (outcome.finished) {
        map.highlight(click.code, 'wrong');
        map.highlight(q.county.code, 'reveal');
        revealAndContinue(`Fel – det var ${countyLabel(click.code, topology)}. Här är ${q.county.name}.`, 'bad');
      } else {
        map.highlight(click.code, 'wrong');
        window.setTimeout(() => map.unhighlight(click.code!, 'wrong'), CONFIG.toastMs);
        toast.show(`Fel, det var ${countyLabel(click.code, topology)}. ${attemptsText(outcome.attemptsLeft)}`, 'bad', CONFIG.toastMs);
      }
    } else {
      const outcome = game.answer({ kind: 'point', lat: click.lat, lon: click.lon });
      const km = Math.round(outcome.distanceKm ?? 0);
      if (outcome.correct) {
        map.addMarker(click.lon, click.lat, 'correct');
        map.addMarker(q.county.lon, q.county.lat, 'reveal', q.county.city);
        revealAndContinue(`Rätt! ${km} km från ${q.county.city} · +${outcome.pointsAwarded} p`, 'ok');
      } else if (outcome.finished) {
        map.addMarker(click.lon, click.lat, 'wrong');
        map.addMarker(q.county.lon, q.county.lat, 'reveal', q.county.city);
        revealAndContinue(`Fel – ${km} km bort. Här ligger ${q.county.city}.`, 'bad');
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

function attemptsText(left: number): string {
  return left === 1 ? 'Sista försöket!' : `${left} försök kvar.`;
}

function countyLabel(code: string, topology: Topology): string {
  const obj = topology.objects.lan as { geometries: { properties?: { code: string; name: string } }[] };
  return obj.geometries.find((g) => g.properties?.code === code)?.properties?.name ?? code;
}

showStart();
registerServiceWorker();

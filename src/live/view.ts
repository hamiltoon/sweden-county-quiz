/**
 * Live-lägets skärmar: lobby, frågor med nedräkning, ställning efter varje fråga och pall.
 * Allt ritas från rummets senaste läge (LiveState) som servern skickar; kartan skapas en gång
 * per match och ligger kvar mellan frågorna.
 */
import type { Topology } from 'topojson-specification';
import { COUNTY_BY_CODE } from '../data/counties';
import { PROVINCE_BY_CODE } from '../data/provinces';
import { MUNICIPALITY_BY_CODE } from '../data/municipalities';
import { LAKE_BY_ID } from '../data/lakes';
import { CONFIG } from '../game/config';
import { distanceToShapeKm } from '../game/geo';
import { modeLabel, questionLabel, questionPrompt, type Question } from '../game/game';
import {
  LIVE_MAX_POINTS,
  LIVE_MIN_POINTS,
  LIVE_KINDS,
  LIVE_MODES,
  LIVE_QUESTIONS,
  LIVE_QUESTION_MS,
  isPointKind,
  liveRevealMs,
  type LiveAnswer,
  type LiveMode,
  type LivePlayer,
  type LiveQuestionKind,
  type LiveState,
} from '../shared/live';
import { SwedenMap, type FitTarget, type MapClick, type PlayerPin, type ResultState } from '../map/map';
import type { RegionSteps } from '../map/adjacency';
import { regionsFor } from '../map/sources';
import { el, clear } from '../ui/dom';
import { Toast } from '../ui/toast';
import { countyName, municipalityName, provinceName, t } from '../i18n';
import type { LiveConnection } from './connection';
import { renderQr } from './qr';
import { toGameQuestion } from './question';
import { kommunMapOptions, takeMagnifyHint } from '../map/kommun';

/** Kartan för en sorts fråga, som main.ts laddar. */
export interface LiveMaps {
  regions: Topology;
  objectName: string;
  groupBy?: string;
  lakes: Topology | null;
  neighbors: Topology | null;
  lakeMode: boolean;
  /** Kommunläget: hur många kommuner bort ett fel klick var. */
  steps: RegionSteps | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];
/** Svar norr om den här breddgraden hamnar under toasten om den ligger överst. */
const NORTH_TOAST_LAT = 64.5;

export class LiveView {
  private state: LiveState | null = null;
  private map: SwedenMap | null = null;
  private maps: LiveMaps | null = null;
  private toast: Toast | null = null;
  private game: { question: HTMLElement; progress: HTMLElement; score: HTMLElement; timerBar: HTMLElement; status: HTMLElement; mapWrap: HTMLElement } | null = null;
  /** Vilken karta som ritas just nu; i Blandat byts den när frågans sort kräver en annan. */
  private mapKey = '';
  private mapReady: Promise<void> | null = null;
  /** Frågan vi senast ritade, så att kartan bara nollställs vid en ny fråga. */
  private shownQuestion = -1;
  private shownPhase = '';
  /** Har vi svarat på den pågående frågan (innan servern bekräftat)? */
  private picked = false;
  private frame = 0;
  private building: Promise<void> | null = null;
  private banner: HTMLElement;

  constructor(
    private readonly screen: HTMLElement,
    private readonly conn: () => LiveConnection | null,
    private readonly loadMaps: (kind: LiveQuestionKind) => Promise<LiveMaps>,
    private readonly onLeave: () => void,
  ) {
    this.banner = el('div', { class: 'live-banner', role: 'status', 'aria-live': 'polite' });
  }

  /** Visar ett meddelande överst, t.ex. "Återansluter …". Tom sträng döljer det. */
  setBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.toggle('is-visible', text !== '');
  }

  showError(message: string): void {
    this.destroyMap();
    this.state = null;
    clear(this.screen);
    this.screen.className = 'screen screen-end';
    const back = el('button', { class: 'btn btn-primary', type: 'button' }, t().common.toStart);
    back.addEventListener('click', this.onLeave);
    this.screen.append(el('section', { class: 'end live-error' }, el('h2', {}, 'Live'), el('p', { class: 'lead' }, message), el('div', { class: 'btn-row' }, back)));
  }

  /** Ett icke-fatalt fel från servern, t.ex. att bara värden kan starta. */
  notify(message: string): void {
    if (this.toast) this.toast.show(message, 'info', 2500);
    else this.setBanner(message);
  }

  render(state: LiveState): void {
    this.state = state;
    if (state.phase === 'lobby') {
      this.destroyMap();
      this.renderLobby(state);
    } else if (state.phase === 'done') {
      this.destroyMap();
      this.renderDone(state);
    } else {
      void this.renderRound(state);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.destroyMap();
  }

  private destroyMap(): void {
    cancelAnimationFrame(this.frame);
    this.map?.destroy();
    this.map = null;
    this.maps = null;
    this.mapKey = '';
    this.mapReady = null;
    this.building = null;
    this.toast = null;
    this.game = null;
    this.shownQuestion = -1;
    this.shownPhase = '';
  }

  private me(state: LiveState): LivePlayer | undefined {
    return state.players.find((p) => p.id === state.you);
  }

  private leaveButton(label = t().live.leave): HTMLButtonElement {
    const btn = el('button', { class: 'btn', type: 'button' }, label);
    btn.addEventListener('click', this.onLeave);
    return btn;
  }

  // ---------- Lobby ----------

  private renderLobby(state: LiveState): void {
    // Kommunkartan är stor; hämta den redan i lobbyn om matchen kan få kommunfrågor.
    if (state.mode === 'kommun' || (state.mode === 'blandat' && state.mix.includes('kommun'))) {
      this.loadMaps('kommun').catch(() => undefined);
    }
    // Lobbyn ritas om vid varje ändring (någon går med, värden byter läge); fokus ska ligga kvar
    // på samma knapp, så att den som använder tangentbord eller skärmläsare inte tappar platsen.
    const focusKey = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-focus-key]')?.dataset.focusKey;
    const scrollTop = this.screen.scrollTop;
    clear(this.screen);
    this.screen.className = 'screen screen-end screen-lobby';
    const isHost = state.hostId === state.you;
    const host = state.players.find((p) => p.id === state.hostId);
    const url = `${location.origin}/live/${state.code}`;

    const share = el('button', { class: 'btn', type: 'button', 'data-focus-key': 'share' }, t().live.share);
    const shareNote = el('p', { class: 'top-note', role: 'status' });
    share.addEventListener('click', () => void shareLink(url, state.code, shareNote));

    let action: HTMLElement;
    if (isHost) {
      const start = el(
        'button',
        { class: 'btn btn-primary', type: 'button', 'data-focus-key': 'start' },
        state.players.length > 1 ? t().live.start : t().live.startAlone,
      );
      start.addEventListener('click', () => this.conn()?.send({ type: 'start' }));
      action = start;
    } else {
      action = el('p', { class: 'live-wait' }, t().live.waitingForHost(host?.name ?? null));
    }

    this.screen.append(
      this.banner,
      el(
        'section',
        { class: 'end live-lobby' },
        el('h2', {}, t().live.lobbyTitle(modeLabel(state.mode))),
        el('p', { class: 'lead' }, t().live.rules(LIVE_QUESTIONS, LIVE_QUESTION_MS / 1000, LIVE_MIN_POINTS, LIVE_MAX_POINTS)),
        el('div', { class: 'live-code-card' }, el('span', { class: 'live-code-label' }, t().live.codeLabel), el('span', { class: 'live-code' }, state.code), share),
        shareNote,
        // Kompisarna i samma rum skannar koden med kameran och hamnar direkt i formuläret för rummet.
        el('figure', { class: 'live-qr' }, renderQr(url, t().live.qrLabel(state.code)), el('figcaption', {}, t().live.qrCaption)),
        renderModePicker(
          state,
          isHost,
          (mode) => this.conn()?.send({ type: 'mode', mode }),
          (kinds) => this.conn()?.send({ type: 'mix', kinds }),
        ),
        el('h3', { class: 'live-heading' }, t().live.players(state.players.length)),
        renderPlayers(state, (p) => (p.id === state.hostId ? t().live.host : '')),
        el('div', { class: 'btn-row' }, this.leaveButton()),
        // Starta matchen ligger kvar nederst på skärmen, så att värden når den utan att scrolla.
        el('div', { class: 'btn-row live-lobby-action' }, action),
      ),
    );
    this.screen.scrollTop = scrollTop;
    if (focusKey) this.screen.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus({ preventScroll: true });
  }

  // ---------- Fråga och avslöjande ----------

  private async renderRound(state: LiveState): Promise<void> {
    // Flera lägen kan komma medan kartan laddas; spelvyn byggs en gång per match, och kartan
    // när frågans sort kräver en ny (i Blandat).
    this.building ??= this.buildGame(state.mode);
    await this.building;
    if (this.state !== state || !this.game || !state.question) return;
    await this.ensureMap(state.question.kind);
    // Ett nyare läge kan ha kommit medan kartan laddades; rita bara det senaste.
    if (this.state !== state || !this.map || !this.game || !state.question) return;
    const q = state.question;
    const gq = toGameQuestion(q);
    const map = this.map;
    const me = this.me(state);

    this.game.progress.textContent = `${q.index + 1}/${q.total}`;
    this.game.score.textContent = t().common.points(me?.score ?? 0);
    this.game.question.textContent = gq ? questionPrompt(gq) : '';

    const newQuestion = q.index !== this.shownQuestion;
    const newPhase = newQuestion || state.phase !== this.shownPhase;
    this.shownQuestion = q.index;
    this.shownPhase = state.phase;

    if (state.phase === 'question') {
      if (newQuestion) {
        this.picked = false;
        map.clearHighlights();
        map.clearMarkers();
        this.toast?.hide();
        // Statusraden först: ställningen från förra frågan försvinner och kartan blir högre, och
        // kartan måste ha sin nya storlek innan den zoomar.
        this.renderStatus(state, Boolean(me?.answered));
        map.resize();
        // Kommunfrågan säger vilket län kommunen ligger i, så kartan zoomar in på länet (PO-16).
        if (gq?.kind === 'kommun') map.focusGroup(gq.municipality.county);
        else if (map.isTransformed) map.resetZoom();
        // Toasten får inte täcka svaret: nederst för sjöarna och städerna längst norrut.
        const target = gq ? targetPoint(gq) : undefined;
        this.toast?.setPlacement(q.kind === 'sjo' || (target && target.lat > NORTH_TOAST_LAT) ? 'bottom' : 'top');
      }
      const answered = Boolean(me?.answered) || this.picked;
      map.setInteractive(!answered);
      this.renderStatus(state, answered);
      if (newPhase) this.runTimer(q.endsAt, LIVE_QUESTION_MS);
      return;
    }

    map.setInteractive(false);
    if (!newPhase || !gq) return;
    map.clearHighlights();
    map.clearMarkers();
    // Ställningen först: den gör kartan lägre, och kartan måste ha sin nya storlek innan den zoomar.
    this.game.status.replaceChildren(...renderStandings(state));
    map.resize();
    this.reveal(gq, state.answers?.find((a) => a.playerId === state.you));
    const pins = playerPins(state);
    map.setPlayerPins(pins);
    // Rätt svar och allas klick i samma vy, så att man ser var det låg och var de andra klickade.
    map.fitView(pins, revealTarget(gq), this.toastPadding());
    this.runTimer(q.endsAt, liveRevealMs(state.players.length));
  }

  /**
   * Visar rätt svar och färgar kartan efter hur det gick för mig. Allas klick (även mitt) ritas
   * sedan som prickar med setPlayerPins().
   */
  private reveal(q: Question, mine: LiveAnswer | undefined): void {
    const map = this.map!;
    const name = questionLabel(q);
    const state: ResultState = mine?.correct ? 'first' : 'missed';
    const show = (text: string, ok: boolean) => this.toast?.show(text, ok ? 'ok' : 'bad', 0);

    if (q.kind === 'stad' || q.kind === 'ort') {
      const target = targetPoint(q)!;
      map.addMarker(target.lon, target.lat, 'reveal', name);
      map.addResultDot(target.lon, target.lat, state);
      if (mine?.correct) show(t().game.rightCity(mine.distanceKm ?? 0, name, mine.points), true);
      else if (mine?.distanceKm !== undefined) show(t().game.missReveal(t().game.wrongKm(mine.distanceKm), name), false);
      else show(t().live.timeUp(name), false);
      return;
    }

    if (q.kind === 'sjo') {
      if (mine?.code && !mine.correct) map.highlightLake(mine.code, 'wrong');
      map.highlightLake(q.lake.id, mine?.correct ? 'correct' : 'reveal');
      map.showLakeLabel(q.lake.id);
      map.setLakeResult(q.lake.id, state);
      if (mine?.correct) show(t().game.rightLake(t().game.lakeRank(q.lake.rank), mine.points), true);
      else if (mine?.code) show(t().game.wrongWasReveal(LAKE_BY_ID.get(mine.code)?.name ?? mine.code, name), false);
      else if (mine?.lat !== undefined && mine.lon !== undefined) {
        // Ett klick på land (eller i havet): hur långt från sjön, som i solospelet (PO-23).
        const shape = map.lakeGeometry(q.lake.id);
        const km = shape ? Math.round(distanceToShapeKm(shape, mine.lat, mine.lon)) : null;
        show(t().game.missReveal(km === null ? t().game.wrong : t().game.wrongKm(km), name), false);
      }
      else show(t().live.timeUp(name), false);
      return;
    }

    // Län, landskap eller kommun.
    const target = q.kind === 'landskap' ? q.province.code : q.kind === 'kommun' ? q.municipality.code : q.county.code;
    if (mine?.code && !mine.correct) map.highlight(mine.code, 'wrong');
    map.highlight(target, mine?.correct ? 'correct' : 'reveal');
    map.setCountyResult(target, state);
    if (mine?.correct) show(t().game.right(mine.points), true);
    else if (mine?.code) {
      const away = this.maps?.steps?.(mine.code, target);
      const clicked = regionName(mine.code);
      show(away ? t().game.wrongWasAwayReveal(clicked, t().game.municipalitiesAway(away), name) : t().game.wrongWasReveal(clicked, name), false);
    } else show(t().live.timeUp(name), false);
  }

  private async buildGame(mode: LiveMode): Promise<void> {
    clear(this.screen);
    this.screen.className = 'screen screen-game';
    const question = el('h2', { class: 'question', 'aria-live': 'polite' }, t().game.loadingMap);
    const progress = el('span', { class: 'hud-progress' }, '');
    const score = el('span', { class: 'hud-score' }, '');
    const quit = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t().live.leaveMatch, title: t().live.leaveTitle }, '✕');
    quit.addEventListener('click', this.onLeave);
    const timerBar = el('div', { class: 'live-timer-bar' });
    const hud = el(
      'header',
      { class: 'hud' },
      el('div', { class: 'hud-row' }, el('span', { class: 'hud-mode' }, `Live · ${modeLabel(mode)}`), progress, score, quit),
      question,
      el('div', { class: 'live-timer', 'aria-hidden': 'true' }, timerBar),
    );
    const mapWrap = el('div', { class: 'map-wrap' });
    const status = el('div', { class: 'live-status', 'aria-live': 'polite' });
    this.screen.append(this.banner, hud, mapWrap, status);
    this.toast = new Toast(mapWrap, 'top');
    this.game = { question, progress, score, timerBar, status, mapWrap };
  }

  /** Ritar kartan som frågans sort behöver, om den inte redan visas. */
  private ensureMap(kind: LiveQuestionKind): Promise<void> {
    const key = `${regionsFor(kind).objectName}:${kind === 'sjo'}`;
    if (key !== this.mapKey || !this.mapReady) {
      this.mapKey = key;
      this.mapReady = this.buildMap(kind, key);
    }
    return this.mapReady;
  }

  private async buildMap(kind: LiveQuestionKind, key: string): Promise<void> {
    const wrap = this.game?.mapWrap;
    if (!wrap) return;
    let maps: LiveMaps;
    try {
      maps = await this.loadMaps(kind);
    } catch {
      if (wrap.isConnected) this.showError(t().common.mapFailed);
      return;
    }
    // Har spelaren lämnat, eller behövs en annan karta nu, ritas inget.
    if (!wrap.isConnected || key !== this.mapKey) return;
    this.map?.destroy();
    wrap.querySelector('.map')?.remove();
    const mapEl = el('div', { class: 'map' });
    wrap.prepend(mapEl);
    const map = new SwedenMap(mapEl, maps.regions, {
      objectName: maps.objectName,
      groupBy: maps.groupBy,
      lakes: maps.lakes,
      neighbors: maps.neighbors,
      lakeMode: maps.lakeMode,
      ...(kind === 'kommun' ? kommunMapOptions() : {}),
    });
    map.onClick = (click) => this.answer(click);
    map.onMagnify = () => takeMagnifyHint() && this.toast?.show(t().game.magnified, 'info', 2000);
    this.map = map;
    this.maps = maps;
  }

  private answer(click: MapClick): void {
    const state = this.state;
    const q = state?.question;
    if (!state || state.phase !== 'question' || !q || this.picked || !this.map) return;
    const send = (answer: { code?: string; lat?: number; lon?: number }) => {
      this.picked = true;
      this.conn()?.send({ type: 'answer', question: q.index, ...answer });
      this.map?.setInteractive(false);
      this.renderStatus(state, true);
    };
    if (isPointKind(q.kind)) {
      // Städerna: klicket är svaret, servern räknar avståndet.
      this.map.addMarker(click.lon, click.lat, 'picked');
      send({ lat: click.lat, lon: click.lon });
    } else if (q.kind === 'sjo') {
      if (click.lake) this.map.highlightLake(click.lake, 'picked');
      else this.map.addMarker(click.lon, click.lat, 'picked');
      send(click.lake ? { code: click.lake, lat: click.lat, lon: click.lon } : { lat: click.lat, lon: click.lon });
    } else if (click.code) {
      // Punkten skickas med, så att klicket kan visas för de andra när svaret avslöjas.
      this.map.highlight(click.code, 'picked');
      send({ code: click.code, lat: click.lat, lon: click.lon });
    } else {
      // Ett klick utanför alla områden (i havet) räknas inte; samma tips som i solospelet (PO-23).
      const hint = q.kind === 'landskap' ? t().game.clickProvince : q.kind === 'kommun' ? t().game.clickMunicipality : t().game.clickCounty;
      this.toast?.show(hint, 'info', CONFIG.toastMs);
    }
  }

  /**
   * Statusraden under frågan: allas namn, med ✓ för den som har svarat (PO-02). Raden visar inte om
   * svaret var rätt, och den rullar i sidled när namnen inte får plats. Skärmläsare får som förut
   * "N av M har svarat"; själva raden ändras för ofta för att läsas upp.
   */
  private renderStatus(state: LiveState, answered: boolean): void {
    const status = this.game?.status;
    if (!status) return;
    const text = statusText(state, answered);
    if (state.players.length <= 1) {
      status.textContent = text;
      return;
    }
    const scroll = status.querySelector('.live-answered')?.scrollLeft ?? 0;
    const row = el(
      'ul',
      { class: 'live-answered', 'aria-hidden': 'true' },
      ...state.players.map((p) => {
        const me = p.id === state.you;
        const done = p.answered || (me && answered);
        const cls = ['live-chip', done ? 'is-answered' : '', p.connected ? '' : 'is-away', me ? 'is-me' : ''].filter(Boolean).join(' ');
        return el(
          'li',
          { class: cls, 'data-player': p.id },
          shortName(p.name),
          done ? el('span', { class: 'live-check' }, ' ✓') : null,
          p.connected ? null : el('span', { class: 'live-chip-away' }, ` · ${t().live.away.toLowerCase()}`),
        );
      }),
    );
    status.replaceChildren(row, el('span', { class: 'visually-hidden' }, text));
    // Raden byggs om vid varje svar; den ska inte hoppa tillbaka om man har rullat i den.
    row.scrollLeft = scroll;
  }

  /** Hur mycket av kartan överst eller nederst som rätt/fel-rutan täcker, med lite luft. */
  private toastPadding(): { top?: number; bottom?: number } {
    const box = this.toast?.bounds();
    const mapBox = this.game?.mapWrap.querySelector('.map')?.getBoundingClientRect();
    if (!box || !mapBox) return {};
    // Rutan glider in 12 px; räkna med där den hamnar.
    const margin = 18;
    return box.top - mapBox.top < mapBox.height / 2
      ? { top: Math.max(0, box.bottom - mapBox.top + margin) }
      : { bottom: Math.max(0, mapBox.bottom - box.top + margin) };
  }

  /** Nedräkningsstapeln: full vid frågans början, tom när tiden är ute. */
  private runTimer(endsAt: number, totalMs: number): void {
    cancelAnimationFrame(this.frame);
    const bar = this.game?.timerBar;
    if (!bar) return;
    bar.classList.toggle('is-reveal', this.state?.phase === 'reveal');
    const tick = () => {
      const left = Math.max(0, endsAt - (this.conn()?.serverNow() ?? Date.now()));
      bar.style.transform = `scaleX(${totalMs > 0 ? Math.min(1, left / totalMs) : 0})`;
      bar.classList.toggle('is-low', this.state?.phase === 'question' && left < 3000);
      if (left > 0) this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- Slut ----------

  private renderDone(state: LiveState): void {
    clear(this.screen);
    this.screen.className = 'screen screen-end';
    const ranked = rank(state.players);
    const mine = ranked.find((r) => r.player.id === state.you);
    const isHost = state.hostId === state.you;
    const host = state.players.find((p) => p.id === state.hostId);

    let again: HTMLElement;
    if (isHost) {
      again = el('button', { class: 'btn btn-primary', type: 'button' }, t().end.again);
      again.addEventListener('click', () => this.conn()?.send({ type: 'lobby' }));
    } else {
      again = el('p', { class: 'live-wait' }, t().live.canRestart(host?.name ?? null));
    }

    this.screen.append(
      this.banner,
      el(
        'section',
        { class: 'end live-done' },
        el('h2', {}, mine?.place === 1 ? t().live.won : t().live.over),
        mine && ranked.length > 1 ? el('p', { class: 'lead' }, t().live.placed(mine.place, ranked.length, mine.player.score)) : null,
        el(
          'ol',
          { class: 'live-podium' },
          ...ranked.map(({ player, place }) =>
            el(
              'li',
              { class: player.id === state.you ? 'is-me' : '' },
              el('span', { class: 'live-place' }, MEDALS[place - 1] ?? `${place}`),
              el('span', { class: 'live-name' }, player.name),
              el('span', { class: 'live-points' }, t().common.points(player.score)),
            ),
          ),
        ),
        el('div', { class: 'btn-row' }, again),
        el('div', { class: 'btn-row' }, this.leaveButton(t().common.toStart)),
      ),
    );
  }
}

/** Var staden ligger i en stadsfråga. */
function targetPoint(q: Question): { lat: number; lon: number } | undefined {
  if (q.kind === 'ort') return q.city;
  if (q.kind === 'stad') return q.county;
  return undefined;
}

/** Rätt svar som kartan ska rymma när svaret visas. */
function revealTarget(q: Question): FitTarget {
  if (q.kind === 'stad' || q.kind === 'ort') return { point: targetPoint(q) };
  if (q.kind === 'sjo') return { lake: q.lake.id };
  return { code: q.kind === 'landskap' ? q.province.code : q.kind === 'kommun' ? q.municipality.code : q.county.code };
}

/** Namnet på ett klickat län, landskap eller kommun. */
function regionName(code: string): string {
  const county = COUNTY_BY_CODE.get(code);
  if (county) return countyName(county);
  const province = PROVINCE_BY_CODE.get(code);
  if (province) return provinceName(province);
  const municipality = MUNICIPALITY_BY_CODE.get(code);
  return municipality ? municipalityName(municipality) : code;
}

/**
 * Lägesväljaren i lobbyn: värden väljer läge och, i Blandat, vilka sorter som blandas. De andra
 * ser vad som gäller.
 */
function renderModePicker(
  state: LiveState,
  isHost: boolean,
  onPick: (mode: LiveMode) => void,
  onMix: (kinds: LiveQuestionKind[]) => void,
): HTMLElement {
  const mixNames = state.mix.map((kind) => modeLabel(kind)).join(', ');
  if (!isHost) {
    return el('p', { class: 'live-mode-note' }, state.mode === 'blandat' ? t().live.modeIsMix(modeLabel(state.mode), mixNames) : t().live.modeIs(modeLabel(state.mode)));
  }
  const chips = LIVE_MODES.map((mode) => {
    const chip = el(
      'button',
      { class: 'live-mode-chip', type: 'button', 'data-mode': mode, 'data-focus-key': `mode:${mode}`, 'aria-pressed': String(mode === state.mode) },
      modeLabel(mode),
    );
    chip.addEventListener('click', () => mode !== state.mode && onPick(mode));
    return chip;
  });
  let mix: HTMLElement | null = null;
  if (state.mode === 'blandat') {
    const kindChips = LIVE_KINDS.map((kind) => {
      const on = state.mix.includes(kind);
      const chip = el(
        'button',
        { class: 'live-mode-chip live-mix-chip', type: 'button', 'data-kind': kind, 'data-focus-key': `kind:${kind}`, 'aria-pressed': String(on) },
        modeLabel(kind),
      );
      // Minst en sort måste vara vald; den sista går inte att slå av.
      chip.addEventListener('click', () => {
        const next = on ? state.mix.filter((k) => k !== kind) : [...state.mix, kind];
        if (next.length) onMix(next);
      });
      return chip;
    });
    mix = el(
      'div',
      { class: 'live-mix' },
      el('h3', { class: 'live-heading' }, t().live.mixHeading),
      el('p', { class: 'live-mode-note' }, t().live.mixHint),
      el('div', { class: 'live-mode-chips', role: 'group', 'aria-label': t().live.mixHeading }, ...kindChips),
    );
  }
  return el(
    'div',
    { class: 'live-modes' },
    el('h3', { class: 'live-heading' }, t().live.chooseMode),
    el('div', { class: 'live-mode-chips', role: 'group', 'aria-label': t().live.chooseMode }, ...chips),
    mix,
  );
}

/** Placering med delad plats vid lika poäng. */
function rank(players: LivePlayer[]): { player: LivePlayer; place: number }[] {
  const sorted = players.slice().sort((a, b) => b.score - a.score);
  return sorted.map((player) => ({ player, place: sorted.findIndex((p) => p.score === player.score) + 1 }));
}

function renderPlayers(state: LiveState, tag: (p: LivePlayer) => string): HTMLElement {
  return el(
    'ul',
    { class: 'live-players' },
    ...state.players.map((p) =>
      el(
        'li',
        { class: [p.id === state.you ? 'is-me' : '', p.connected ? '' : 'is-away'].join(' ').trim() },
        el('span', { class: 'live-name' }, p.name, p.id === state.you ? t().live.you : ''),
        el('span', { class: 'live-tag' }, p.connected ? tag(p) : t().live.away),
      ),
    ),
  );
}

/** Längre namn kortas i raden med vem som har svarat, så att fler får plats. */
function shortName(name: string): string {
  return name.length > 10 ? `${name.slice(0, 9).trimEnd()}…` : name;
}

function statusText(state: LiveState, answered: boolean): string {
  const present = state.players.filter((p) => p.connected);
  const done = present.filter((p) => p.answered || (p.id === state.you && answered)).length;
  if (present.length <= 1) return answered ? t().live.answerSent : t().live.tapMap;
  return t().live.answered(answered, done, present.length);
}

/** Allas klick på frågan; den som inte svarade (eller svarade från en äldre version) får ingen prick. */
function playerPins(state: LiveState): PlayerPin[] {
  const names = new Map(state.players.map((p) => [p.id, p.name]));
  return (state.answers ?? []).flatMap((a) => {
    const name = names.get(a.playerId);
    if (a.lat === undefined || a.lon === undefined || name === undefined) return [];
    return [{ lon: a.lon, lat: a.lat, name, correct: a.correct, mine: a.playerId === state.you }];
  });
}

/** Med fler spelare än så visas bara topp 3 och den egna raden under avslöjandet; alla syns på pallen. */
const STANDINGS_ALL_UP_TO = 5;
const STANDINGS_TOP = 3;

/**
 * Ställningen efter en fråga: den snabbaste med rätt svar, och spelarna med poängen för frågan.
 * Med många spelare visas topp 3, den egna raden och hur många fler det finns, så att kartan får
 * plats. Den egna raden visar också den egna svarstiden.
 */
function renderStandings(state: LiveState): HTMLElement[] {
  const answers = new Map((state.answers ?? []).map((a) => [a.playerId, a]));
  const fastest = (state.answers ?? [])
    .filter((a) => a.correct && a.ms !== undefined)
    .sort((a, b) => a.ms! - b.ms!)[0];
  const fastestName = fastest && state.players.find((p) => p.id === fastest.playerId)?.name;
  const ranked = rank(state.players);
  const shown =
    ranked.length <= STANDINGS_ALL_UP_TO
      ? ranked
      : ranked.filter((r, i) => i < STANDINGS_TOP || r.player.id === state.you);
  const hidden = ranked.length - shown.length;
  const list = el(
    'ol',
    { class: 'live-standings' },
    ...shown.map(({ player, place }) => {
      const a = answers.get(player.id);
      const answered = a && (a.code !== null || a.lat !== undefined);
      return el(
        'li',
        { class: player.id === state.you ? 'is-me' : '' },
        el('span', { class: 'live-place' }, `${place}`),
        el('span', { class: 'live-name' }, player.name),
        player.id === state.you && a?.ms !== undefined
          ? el('span', { class: 'live-time', title: t().live.yourTime(t().live.seconds(a.ms)) }, t().live.seconds(a.ms))
          : null,
        el('span', { class: `live-delta ${a?.correct ? 'is-ok' : 'is-bad'}` }, a?.correct ? `+${a.points}` : answered ? '✗' : '–'),
        el('span', { class: 'live-points' }, t().common.points(player.score)),
      );
    }),
    hidden > 0 ? el('li', { class: 'live-more' }, t().live.andMore(hidden)) : null,
  );
  return fastest && fastestName ? [el('p', { class: 'live-fastest' }, t().live.fastest(fastestName, t().live.seconds(fastest.ms!))), list] : [list];
}

async function shareLink(url: string, code: string, note: HTMLElement): Promise<void> {
  const text = t().live.shareText(code);
  try {
    if (navigator.share) {
      await navigator.share({ title: t().live.shareTitle, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    note.textContent = t().live.copied;
  } catch (err) {
    // Avbruten delning är inget fel; annars visas länken så att den går att kopiera för hand.
    if ((err as Error)?.name !== 'AbortError') note.textContent = url;
  }
}

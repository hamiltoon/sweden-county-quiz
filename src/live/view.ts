/**
 * Live-lägets skärmar: lobby, frågor med nedräkning, ställning efter varje fråga och pall.
 * Allt ritas från rummets senaste läge (LiveState) som servern skickar; kartan skapas en gång
 * per match och ligger kvar mellan frågorna.
 */
import type { Topology } from 'topojson-specification';
import { COUNTY_BY_CODE } from '../data/counties';
import { LIVE_MAX_POINTS, LIVE_MIN_POINTS, LIVE_QUESTIONS, LIVE_QUESTION_MS, LIVE_REVEAL_MS, type LivePlayer, type LiveState } from '../shared/live';
import { SwedenMap, type MapClick } from '../map/map';
import { el, clear } from '../ui/dom';
import { Toast } from '../ui/toast';
import { countyName, t } from '../i18n';
import type { LiveConnection } from './connection';

export interface LiveMaps {
  counties: Topology;
  lakes: Topology | null;
  neighbors: Topology | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export class LiveView {
  private state: LiveState | null = null;
  private map: SwedenMap | null = null;
  private toast: Toast | null = null;
  private game: { question: HTMLElement; progress: HTMLElement; score: HTMLElement; timerBar: HTMLElement; status: HTMLElement } | null = null;
  /** Frågan vi senast ritade, så att kartan bara nollställs vid en ny fråga. */
  private shownQuestion = -1;
  private shownPhase = '';
  /** Länet vi klickade på i den pågående frågan (innan servern bekräftat). */
  private picked: string | null = null;
  private frame = 0;
  private building: Promise<void> | null = null;
  private banner: HTMLElement;

  constructor(
    private readonly screen: HTMLElement,
    private readonly conn: () => LiveConnection | null,
    private readonly maps: Promise<LiveMaps>,
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
    clear(this.screen);
    this.screen.className = 'screen screen-end';
    const isHost = state.hostId === state.you;
    const host = state.players.find((p) => p.id === state.hostId);
    const url = `${location.origin}/live/${state.code}`;

    const share = el('button', { class: 'btn', type: 'button' }, t().live.share);
    const shareNote = el('p', { class: 'top-note', role: 'status' });
    share.addEventListener('click', () => void shareLink(url, state.code, shareNote));

    let action: HTMLElement;
    if (isHost) {
      const start = el('button', { class: 'btn btn-primary', type: 'button' }, state.players.length > 1 ? t().live.start : t().live.startAlone);
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
        el('h2', {}, t().live.lobbyTitle),
        el('p', { class: 'lead' }, t().live.rules(LIVE_QUESTIONS, LIVE_QUESTION_MS / 1000, LIVE_MIN_POINTS, LIVE_MAX_POINTS)),
        el('div', { class: 'live-code-card' }, el('span', { class: 'live-code-label' }, t().live.codeLabel), el('span', { class: 'live-code' }, state.code), share),
        shareNote,
        el('h3', { class: 'live-heading' }, t().live.players(state.players.length)),
        renderPlayers(state, (p) => (p.id === state.hostId ? t().live.host : '')),
        el('div', { class: 'btn-row' }, action),
        el('div', { class: 'btn-row' }, this.leaveButton()),
      ),
    );
  }

  // ---------- Fråga och avslöjande ----------

  private async renderRound(state: LiveState): Promise<void> {
    // Flera lägen kan komma medan kartan laddas; den byggs bara en gång.
    this.building ??= this.buildGame();
    await this.building;
    // Ett nyare läge kan ha kommit medan kartan laddades; rita bara det senaste.
    if (this.state !== state || !this.map || !this.game || !state.question) return;
    const q = state.question;
    const map = this.map;
    const county = COUNTY_BY_CODE.get(q.target);
    const name = county ? countyName(county) : q.target;
    const me = this.me(state);

    this.game.progress.textContent = `${q.index + 1}/${q.total}`;
    this.game.score.textContent = t().common.points(me?.score ?? 0);
    this.game.question.textContent = t().game.where(name);

    const newQuestion = q.index !== this.shownQuestion;
    const newPhase = newQuestion || state.phase !== this.shownPhase;
    this.shownQuestion = q.index;
    this.shownPhase = state.phase;

    if (state.phase === 'question') {
      if (newQuestion) {
        this.picked = null;
        map.clearHighlights();
        this.toast?.hide();
        if (map.isTransformed) map.resetZoom();
      }
      const answered = Boolean(me?.answered) || this.picked !== null;
      map.setInteractive(!answered);
      this.game.status.textContent = statusText(state, answered);
      if (newPhase) this.runTimer(q.endsAt, LIVE_QUESTION_MS);
      return;
    }

    // Avslöjande: rätt län, mitt eget klick, och ställningen.
    map.setInteractive(false);
    if (!newPhase) return;
    const mine = state.answers?.find((a) => a.playerId === state.you);
    map.clearHighlights();
    if (mine?.code && !mine.correct) map.highlight(mine.code, 'wrong');
    map.highlight(q.target, mine?.correct ? 'correct' : 'reveal');
    if (county) map.setCountyResult(q.target, mine?.correct ? 'first' : 'missed');
    if (!mine?.correct) map.focusCounty(q.target);
    const clicked = mine?.code ? COUNTY_BY_CODE.get(mine.code) : undefined;
    if (mine?.correct) this.toast?.show(t().game.right(mine.points), 'ok', 0);
    else if (mine?.code) this.toast?.show(t().game.wrongWasReveal(clicked ? countyName(clicked) : mine.code, name), 'bad', 0);
    else this.toast?.show(t().live.timeUp(name), 'bad', 0);
    this.game.status.replaceChildren(renderStandings(state));
    this.runTimer(q.endsAt, LIVE_REVEAL_MS);
  }

  private async buildGame(): Promise<void> {
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
      el('div', { class: 'hud-row' }, el('span', { class: 'hud-mode' }, `Live · ${this.state?.code ?? ''}`), progress, score, quit),
      question,
      el('div', { class: 'live-timer', 'aria-hidden': 'true' }, timerBar),
    );
    const mapWrap = el('div', { class: 'map-wrap' });
    const mapEl = el('div', { class: 'map' });
    mapWrap.append(mapEl);
    const status = el('div', { class: 'live-status', 'aria-live': 'polite' });
    this.screen.append(this.banner, hud, mapWrap, status);

    let maps: LiveMaps;
    try {
      maps = await this.maps;
    } catch {
      if (mapEl.isConnected) this.showError(t().common.mapFailed);
      return;
    }
    // Har spelaren lämnat medan kartan laddades finns det inget att rita på.
    if (!mapEl.isConnected) return;
    const map = new SwedenMap(mapEl, maps.counties, { lakes: maps.lakes, neighbors: maps.neighbors });
    map.onClick = (click) => this.answer(click);
    this.map = map;
    this.toast = new Toast(mapWrap, 'top');
    this.game = { question, progress, score, timerBar, status };
  }

  private answer(click: MapClick): void {
    const state = this.state;
    if (!state || state.phase !== 'question' || !state.question || this.picked || !click.code || !this.map) return;
    this.picked = click.code;
    this.conn()?.send({ type: 'answer', question: state.question.index, code: click.code });
    this.map.highlight(click.code, 'picked');
    this.map.setInteractive(false);
    if (this.game) this.game.status.textContent = statusText(state, true);
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

function statusText(state: LiveState, answered: boolean): string {
  const present = state.players.filter((p) => p.connected);
  const done = present.filter((p) => p.answered || (p.id === state.you && answered)).length;
  if (present.length <= 1) return answered ? t().live.answerSent : t().live.clickCounty;
  return t().live.answered(answered, done, present.length);
}

/** Ställningen efter en fråga: alla spelare med poängen för frågan. */
function renderStandings(state: LiveState): HTMLElement {
  const answers = new Map((state.answers ?? []).map((a) => [a.playerId, a]));
  return el(
    'ol',
    { class: 'live-standings' },
    ...rank(state.players).map(({ player, place }) => {
      const a = answers.get(player.id);
      return el(
        'li',
        { class: player.id === state.you ? 'is-me' : '' },
        el('span', { class: 'live-place' }, `${place}`),
        el('span', { class: 'live-name' }, player.name),
        el('span', { class: `live-delta ${a?.correct ? 'is-ok' : 'is-bad'}` }, a?.correct ? `+${a.points}` : a?.code ? '✗' : '–'),
        el('span', { class: 'live-points' }, t().common.points(player.score)),
      );
    }),
  );
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

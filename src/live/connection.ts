/**
 * Anslutningen till ett live-rum. Servern skickar hela rummets läge efter varje ändring; tappas
 * anslutningen försöker vi igen med växande paus, och spelaren kommer tillbaka som samma spelare.
 */
import type { LiveClientMessage, LiveCreateResponse, LiveServerMessage, LiveState } from '../shared/live';
import { t } from '../i18n';

const RETRY_MS = [1000, 2000, 4000, 8000];

export interface LiveHandlers {
  onState: (state: LiveState) => void;
  /** Ett fel från servern. Är det `fatal` går rummet inte att använda (finns inte, fullt …). */
  onError: (message: string, fatal: boolean) => void;
  /** Anslutningen tappades och ett nytt försök görs (true), eller är tillbaka (false). */
  onReconnecting: (reconnecting: boolean) => void;
}

export async function createRoom(): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/live', { method: 'POST', signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error(t().common.serverUnreachable);
  }
  const data = (await res.json().catch(() => null)) as (LiveCreateResponse & { error?: string }) | null;
  if (!res.ok || !data?.code) throw new Error(data?.error ?? t().live.createFailedStatus(res.status));
  return data.code;
}

export class LiveConnection {
  private ws: WebSocket | null = null;
  private closed = false;
  private retries = 0;
  private retryTimer: number | undefined;
  /** Serverns klocka minus vår, uppdateras med varje läge. */
  private clockOffset = 0;

  constructor(
    private readonly code: string,
    private readonly playerId: string,
    private readonly name: string,
    private readonly handlers: LiveHandlers,
  ) {
    this.connect();
  }

  /** Nu i serverns klocka (ms), för att räkna ned till state.question.endsAt. */
  serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  send(message: LiveClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.closed = true;
    window.clearTimeout(this.retryTimer);
    this.ws?.close(1000, 'Lämnade rummet');
  }

  private connect(): void {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({ player: this.playerId, name: this.name });
    const ws = new WebSocket(`${scheme}://${location.host}/api/live/${this.code}/ws?${params}`);
    this.ws = ws;
    ws.addEventListener('message', (event) => {
      let msg: LiveServerMessage;
      try {
        msg = JSON.parse(String(event.data)) as LiveServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'state') {
        this.clockOffset = msg.state.serverNow - Date.now();
        if (this.retries > 0) this.handlers.onReconnecting(false);
        this.retries = 0;
        this.handlers.onState(msg.state);
      } else {
        if (msg.fatal) this.closed = true;
        this.handlers.onError(msg.message, msg.fatal);
      }
    });
    ws.addEventListener('close', (event) => {
      if (this.ws !== ws || this.closed) return;
      // 4001: samma spelare anslöt från en annan flik; den här ska inte ta tillbaka platsen.
      if (event.code === 4001 || event.code === 4002) {
        this.closed = true;
        this.handlers.onError(event.code === 4001 ? t().live.otherTab : t().live.closed, true);
        return;
      }
      this.handlers.onReconnecting(true);
      const delay = RETRY_MS[Math.min(this.retries, RETRY_MS.length - 1)];
      this.retries += 1;
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    });
  }
}

/**
 * Frivilligt konto med passkey: skydda sitt namn och logga in på andra enheter.
 * Inloggningen ligger i en HttpOnly-cookie som webbläsaren skickar med automatiskt;
 * spelet själv ser aldrig någon token.
 */
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { MeResponse, PasskeyDoneResponse, PasskeyOptionsResponse } from '../shared/account';
import { clearPlayerName } from '../game/storage';
import { LeaderboardError, setPlayerName } from './leaderboard';

const TIMEOUT_MS = 10000;

export function supportsPasskeys(): boolean {
  return browserSupportsWebAuthn();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new LeaderboardError('Servern går inte att nå just nu.', 0);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new LeaderboardError(data?.error ?? `Fel från servern (${res.status}).`, res.status);
  return data;
}

/** Inloggad spelare, eller null. Ett nätverksfel räknas som utloggad. */
export async function fetchMe(): Promise<string | null> {
  try {
    const res = await fetch('/api/me', { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return ((await res.json()) as MeResponse).name;
  } catch {
    return null;
  }
}

/** Gör ett användarvänligt fel av det som kan gå snett i webbläsarens passkey-dialog. */
function passkeyError(err: unknown): Error {
  if (err instanceof LeaderboardError) return err;
  if (err instanceof WebAuthnError || (err instanceof Error && err.name === 'NotAllowedError')) {
    return new Error('Avbrutet. Försök igen när du vill.');
  }
  return new Error('Det gick inte att använda passkeyn på den här enheten.');
}

/**
 * Skyddar namnet med en ny passkey (Face ID, Touch ID, skärmlås eller säkerhetsnyckel)
 * och loggar in. Returnerar kontots namn.
 */
export async function protectName(name: string): Promise<string> {
  try {
    const { challenge, options } = await post<PasskeyOptionsResponse<PublicKeyCredentialCreationOptionsJSON>>(
      '/api/passkey/register/options',
      { name },
    );
    const response = await startRegistration({ optionsJSON: options });
    const done = await post<PasskeyDoneResponse>('/api/passkey/register/verify', { challenge, response });
    setPlayerName(done.name);
    return done.name;
  } catch (err) {
    throw passkeyError(err);
  }
}

/** Loggar in med en befintlig passkey, t.ex. på en ny enhet. Returnerar kontots namn. */
export async function loginWithPasskey(): Promise<string> {
  try {
    const { challenge, options } = await post<PasskeyOptionsResponse<PublicKeyCredentialRequestOptionsJSON>>(
      '/api/passkey/login/options',
      {},
    );
    const response = await startAuthentication({ optionsJSON: options });
    const done = await post<PasskeyDoneResponse>('/api/passkey/login/verify', { challenge, response });
    // Samma som att välja namnet på enheten: tidigare rekord här laddas upp under kontot.
    setPlayerName(done.name);
    return done.name;
  } catch (err) {
    throw passkeyError(err);
  }
}

/** Loggar ut den här enheten. Namnet glöms också, eftersom det är skyddat och inte går att spara under utan inloggning. */
export async function logout(): Promise<void> {
  await post('/api/logout', {}).catch(() => undefined);
  clearPlayerName();
}

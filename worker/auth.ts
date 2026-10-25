/**
 * Frivilliga konton med passkeys (WebAuthn). En spelare kan skydda sitt namn med Face ID,
 * Touch ID eller liknande; därefter kan bara den som är inloggad spara resultat under namnet.
 *
 *   GET  /api/me                          → { name, language } för inloggad spelare, annars null-värden
 *   POST /api/me/language                 → { language } → sparar språket på kontot (om inloggad)
 *   POST /api/logout                      → loggar ut den här enheten
 *   POST /api/passkey/register/options    → { name } → utmaning för att skapa en passkey
 *   POST /api/passkey/register/verify     → { challenge, response } → skyddar namnet och loggar in
 *   POST /api/passkey/login/options       → utmaning för att logga in
 *   POST /api/passkey/login/verify        → { challenge, response } → loggar in
 *
 * Inga lösenord eller hemligheter: servern sparar bara passkeyns publika nyckel, och inloggningen
 * är en slumpad token i en HttpOnly-cookie (bara en hash av den sparas i databasen).
 * Relying Party är den värd sidan körs på, så samma kod fungerar lokalt och i produktion.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { normalizeName } from '../src/shared/leaderboard';
import { SESSION_DAYS, type MeResponse, type PasskeyDoneResponse } from '../src/shared/account';
import { isLang } from '../src/shared/i18n';
import { clientIp, json, readCookie, readJson } from './http';
import { msg, type ServerMessages } from './messages';

const RP_NAME = 'Sverigespelet';
const COOKIE = '__Host-session';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_AUTH_BODY_BYTES = 16 * 1024;

export interface Player {
  id: string;
  name: string;
  name_key: string;
  language: string | null;
}

export const nameKeyOf = (name: string) => name.toLocaleLowerCase('sv');

/** Hanterar /api/me, /api/logout och /api/passkey/*. Returnerar null för andra sökvägar. */
export async function handleAuth(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname;
  const m = msg(request);
  if (path === '/api/me' && request.method === 'GET') {
    const player = await sessionPlayer(request, env);
    const body: MeResponse = { name: player?.name ?? null, language: isLang(player?.language) ? player.language : null };
    return json(body);
  }
  if (path === '/api/me/language' && request.method === 'POST') return saveLanguage(request, env, m);
  if (path === '/api/logout' && request.method === 'POST') return logout(request, env);
  if (!path.startsWith('/api/passkey/')) return null;
  if (request.method !== 'POST') return json({ error: m.method }, 405, { Allow: 'POST' });

  const { success } = await env.SUBMIT_LIMITER.limit({ key: `auth:${clientIp(request)}` });
  if (!success) return json({ error: m.tooMany }, 429);

  const read = await readJson(request, MAX_AUTH_BODY_BYTES);
  if ('error' in read) return read.error;
  const body = (read.body ?? {}) as Record<string, unknown>;

  switch (path) {
    case '/api/passkey/register/options':
      return registerOptions(request, env, url, body, m);
    case '/api/passkey/register/verify':
      return registerVerify(env, url, body, m);
    case '/api/passkey/login/options':
      return loginOptions(env, url);
    case '/api/passkey/login/verify':
      return loginVerify(env, url, body, m);
    default:
      return json({ error: m.notFound }, 404);
  }
}

/** Den inloggade spelaren för den här förfrågan, om sessionscookien är giltig. */
export async function sessionPlayer(request: Request, env: Env): Promise<Player | null> {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT players.id, players.name, players.name_key, players.language
     FROM sessions JOIN players ON players.id = sessions.player_id
     WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2`,
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<Player>();
}

/** Spelaren som skyddat ett namn, om någon har gjort det. */
export function protectedPlayer(env: Env, nameKey: string): Promise<Player | null> {
  return env.DB.prepare('SELECT id, name, name_key, language FROM players WHERE name_key = ?1').bind(nameKey).first<Player>();
}

async function registerOptions(request: Request, env: Env, url: URL, body: Record<string, unknown>, m: ServerMessages): Promise<Response> {
  await cleanupChallenges(env);
  const session = await sessionPlayer(request, env);
  // Inloggad: lägg till ytterligare en passkey för det egna kontot (t.ex. för en annan enhet).
  // Annars: skydda namnet, om ingen annan redan har gjort det.
  let player: Player | null = session;
  let name: string;
  if (session) {
    name = session.name;
  } else {
    const normalized = normalizeName(body.name);
    if (!normalized) return json({ error: m.writeName }, 400);
    name = normalized;
    player = await protectedPlayer(env, nameKeyOf(name));
    if (player) {
      return json({ error: m.alreadyProtected(player.name) }, 409);
    }
  }

  const userId = player?.id ?? isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(16)));
  const existing = player
    ? (await env.DB.prepare('SELECT id, transports FROM passkeys WHERE player_id = ?1').bind(player.id).all<{ id: string; transports: string | null }>())
        .results
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: url.hostname,
    userName: name,
    userDisplayName: name,
    userID: isoBase64URL.toBuffer(userId),
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });

  await env.DB.prepare(
    `INSERT INTO auth_challenges (challenge, kind, name, player_id, user_id, expires_at) VALUES (?1, 'register', ?2, ?3, ?4, ?5)`,
  )
    .bind(options.challenge, name, player?.id ?? null, userId, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString())
    .run();
  return json({ challenge: options.challenge, options });
}

async function registerVerify(env: Env, url: URL, body: Record<string, unknown>, m: ServerMessages): Promise<Response> {
  const row = await takeChallenge(env, body.challenge, 'register');
  if (!row || !row.name || !row.user_id) return json({ error: m.challengeExpired }, 400);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: row.challenge,
      expectedOrigin: url.origin,
      expectedRPID: url.hostname,
      requireUserVerification: false,
    });
  } catch (err) {
    console.warn('Passkey-registrering avvisad', err);
    return json({ error: m.passkeyNotVerified }, 400);
  }
  if (!verification.verified || !verification.registrationInfo) return json({ error: m.passkeyNotVerified }, 400);
  const { credential } = verification.registrationInfo;

  let playerId = row.player_id;
  let name = row.name;
  if (!playerId) {
    // Nytt skyddat namn. UNIQUE på name_key gör att två som skyddar samma namn samtidigt inte båda lyckas.
    const inserted = await env.DB.prepare(
      'INSERT INTO players (id, name, name_key) VALUES (?1, ?2, ?3) ON CONFLICT (name_key) DO NOTHING',
    )
      .bind(row.user_id, row.name, nameKeyOf(row.name))
      .run();
    if (!inserted.meta.changes) return json({ error: m.justProtected(row.name) }, 409);
    playerId = row.user_id;
  } else {
    const player = await env.DB.prepare('SELECT name FROM players WHERE id = ?1').bind(playerId).first<{ name: string }>();
    if (!player) return json({ error: m.accountGone }, 400);
    name = player.name;
  }

  await env.DB.prepare('INSERT INTO passkeys (id, player_id, public_key, counter, transports) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(credential.id, playerId, isoBase64URL.fromBuffer(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []))
    .run();

  const body2: PasskeyDoneResponse = { name };
  return json(body2, 201, { 'Set-Cookie': await createSession(env, playerId) });
}

async function loginOptions(env: Env, url: URL): Promise<Response> {
  await cleanupChallenges(env);
  // Inga allowCredentials: webbläsaren visar spelarens passkeys för den här sajten (discoverable credentials).
  const options = await generateAuthenticationOptions({ rpID: url.hostname, userVerification: 'preferred' });
  await env.DB.prepare(`INSERT INTO auth_challenges (challenge, kind, expires_at) VALUES (?1, 'login', ?2)`)
    .bind(options.challenge, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString())
    .run();
  return json({ challenge: options.challenge, options });
}

async function loginVerify(env: Env, url: URL, body: Record<string, unknown>, m: ServerMessages): Promise<Response> {
  const row = await takeChallenge(env, body.challenge, 'login');
  if (!row) return json({ error: m.challengeExpired }, 400);
  const response = body.response as AuthenticationResponseJSON | undefined;
  if (!response || typeof response.id !== 'string') return json({ error: m.badResponse }, 400);

  const passkey = await env.DB.prepare(
    `SELECT passkeys.id, passkeys.public_key, passkeys.counter, passkeys.transports, players.id AS player_id, players.name
     FROM passkeys JOIN players ON players.id = passkeys.player_id WHERE passkeys.id = ?1`,
  )
    .bind(response.id)
    .first<{ id: string; public_key: string; counter: number; transports: string | null; player_id: string; name: string }>();
  if (!passkey) return json({ error: m.unknownPasskey }, 401);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: row.challenge,
      expectedOrigin: url.origin,
      expectedRPID: url.hostname,
      credential: {
        id: passkey.id,
        publicKey: isoBase64URL.toBuffer(passkey.public_key),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports),
      },
      requireUserVerification: false,
    });
  } catch (err) {
    console.warn('Passkey-inloggning avvisad', err);
    return json({ error: m.loginNotVerified }, 401);
  }
  if (!verification.verified) return json({ error: m.loginNotVerified }, 401);

  await env.DB.prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3')
    .bind(verification.authenticationInfo.newCounter, new Date().toISOString(), passkey.id)
    .run();
  const done: PasskeyDoneResponse = { name: passkey.name };
  return json(done, 200, { 'Set-Cookie': await createSession(env, passkey.player_id) });
}

/**
 * Sparar spelarens språk på kontot, så att det följer med till andra enheter. Utan inloggning
 * finns inget konto att spara på; då gäller valet bara på enheten och svaret säger det.
 */
async function saveLanguage(request: Request, env: Env, m: ServerMessages): Promise<Response> {
  const read = await readJson(request, 256);
  if ('error' in read) return read.error;
  const language = (read.body as { language?: unknown } | null)?.language;
  if (!isLang(language)) return json({ error: m.badLanguage }, 400);
  const player = await sessionPlayer(request, env);
  if (!player) return json({ saved: false });
  await env.DB.prepare('UPDATE players SET language = ?1 WHERE id = ?2').bind(language, player.id).run();
  return json({ saved: true });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256(token)).run();
  return json({ name: null }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
}

async function createSession(env: Env, playerId: string): Promise<string> {
  const token = isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32)));
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await env.DB.prepare('INSERT INTO sessions (token_hash, player_id, expires_at) VALUES (?1, ?2, ?3)')
    .bind(await sha256(token), playerId, new Date(Date.now() + maxAge * 1000).toISOString())
    .run();
  return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

interface ChallengeRow {
  challenge: string;
  name: string | null;
  player_id: string | null;
  user_id: string | null;
}

/** Hämtar och förbrukar en utmaning, så att den bara kan användas en gång. */
async function takeChallenge(env: Env, challenge: unknown, kind: 'register' | 'login'): Promise<ChallengeRow | null> {
  if (typeof challenge !== 'string' || challenge.length > 200) return null;
  return env.DB.prepare(
    `DELETE FROM auth_challenges WHERE challenge = ?1 AND kind = ?2 AND expires_at > ?3
     RETURNING challenge, name, player_id, user_id`,
  )
    .bind(challenge, kind, new Date().toISOString())
    .first<ChallengeRow>();
}

async function cleanupChallenges(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at <= ?1').bind(new Date().toISOString()).run();
}

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AuthenticatorTransportFuture[]) : undefined;
  } catch {
    return undefined;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

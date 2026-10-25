/**
 * Typer för de frivilliga kontona (passkeys), delade mellan spelet och API:t.
 * WebAuthn-objekten själva skickas som JSON enligt @simplewebauthn.
 */

import type { Lang } from './i18n';

/** GET /api/me: inloggad spelare (eller null) och kontots språk (null om inget är sparat). */
export interface MeResponse {
  name: string | null;
  language: Lang | null;
}

/** Svar från .../options: utmaningen ska skickas tillbaka tillsammans med webbläsarens svar. */
export interface PasskeyOptionsResponse<TOptions> {
  challenge: string;
  options: TOptions;
}

/** Svar när registrering eller inloggning lyckats. */
export interface PasskeyDoneResponse {
  name: string;
}

/** Hur länge en inloggning gäller. */
export const SESSION_DAYS = 180;

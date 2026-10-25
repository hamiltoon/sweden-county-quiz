/**
 * Typer för de frivilliga kontona (passkeys), delade mellan spelet och API:t.
 * WebAuthn-objekten själva skickas som JSON enligt @simplewebauthn.
 */

/** GET /api/me: inloggad spelare, eller null. */
export interface MeResponse {
  name: string | null;
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

/**
 * API:ts felmeddelanden på svenska och engelska. Språket kommer från cookien som spelet sätter
 * (se src/i18n/index.ts); utan cookie blir det svenska.
 */
import { LANG_COOKIE, isLang, type Lang } from '../src/shared/i18n';
import { readCookie } from './http';

const sv = {
  crossOrigin: 'Anrop från andra webbplatser godtas inte.',
  method: 'Metoden stöds inte.',
  notFound: 'Hittades inte.',
  serverError: 'Något gick fel på servern.',
  unknownMode: 'Okänt läge.',
  tooMany: 'För många försök. Vänta en minut och försök igen.',
  nameProtected: (name: string) => `Namnet ${name} är skyddat. Logga in med din passkey eller välj ett annat namn.`,
  expectedObject: 'Förväntade ett objekt.',
  noName: 'Namn saknas.',
  noResults: 'Inga resultat.',
  tooManyResults: 'För många resultat på en gång.',
  badResult: 'Ogiltigt resultat.',
  badId: 'Ogiltigt id.',
  notIntegers: 'Poäng och procent måste vara heltal.',
  impossibleScore: 'Omöjlig poäng.',
  impossiblePercent: 'Omöjlig procent.',
  inconsistent: 'Poäng och procent stämmer inte överens.',
  noDate: 'Datum saknas.',
  badDate: 'Ogiltigt datum.',
  writeName: 'Skriv ett namn först.',
  alreadyProtected: (name: string) => `Namnet ${name} är redan skyddat. Logga in med din passkey eller välj ett annat namn.`,
  challengeExpired: 'Utmaningen har gått ut. Försök igen.',
  passkeyNotVerified: 'Passkeyn kunde inte verifieras.',
  justProtected: (name: string) => `Namnet ${name} skyddades precis av någon annan.`,
  accountGone: 'Kontot finns inte längre.',
  badResponse: 'Ogiltigt svar.',
  unknownPasskey: 'Den här passkeyn känns inte igen. Den kan ha tagits bort.',
  loginNotVerified: 'Inloggningen kunde inte verifieras.',
  badLanguage: 'Okänt språk.',
  tooLarge: 'För stor förfrågan.',
  badJson: 'Ogiltig JSON.',
  tooManyRooms: 'För många nya rum. Vänta en minut och försök igen.',
  roomCreateFailed: 'Kunde inte skapa ett rum just nu. Försök igen.',
  badRoomCode: 'Ogiltig rumskod.',
  expectedWebSocket: 'Förväntade WebSocket.',
  noRoom: 'Rummet finns inte. Kontrollera koden.',
  badPlayer: 'Ogiltig spelare.',
  roomFull: (max: number) => `Rummet är fullt (max ${max} spelare).`,
  hostOnly: 'Bara den som skapade rummet kan starta.',
  badRule: 'Okänd minnesregel.',
  badDevice: 'Ogiltig enhet.',
  badVote: 'Ogiltig röst.',
  noText: 'Skriv något först.',
  badKind: 'Ogiltig sorts förslag.',
};

export type ServerMessages = typeof sv;

const en: ServerMessages = {
  crossOrigin: 'Requests from other websites are not accepted.',
  method: 'Method not supported.',
  notFound: 'Not found.',
  serverError: 'Something went wrong on the server.',
  unknownMode: 'Unknown mode.',
  tooMany: 'Too many attempts. Wait a minute and try again.',
  nameProtected: (name) => `The name ${name} is protected. Sign in with your passkey or pick another name.`,
  expectedObject: 'Expected an object.',
  noName: 'Name missing.',
  noResults: 'No results.',
  tooManyResults: 'Too many results at once.',
  badResult: 'Invalid result.',
  badId: 'Invalid id.',
  notIntegers: 'Score and percent must be integers.',
  impossibleScore: 'Impossible score.',
  impossiblePercent: 'Impossible percent.',
  inconsistent: "Score and percent don't match.",
  noDate: 'Date missing.',
  badDate: 'Invalid date.',
  writeName: 'Enter a name first.',
  alreadyProtected: (name) => `The name ${name} is already protected. Sign in with your passkey or pick another name.`,
  challengeExpired: 'The challenge has expired. Try again.',
  passkeyNotVerified: "The passkey couldn't be verified.",
  justProtected: (name) => `The name ${name} was just protected by someone else.`,
  accountGone: 'The account no longer exists.',
  badResponse: 'Invalid response.',
  unknownPasskey: "This passkey isn't recognised. It may have been removed.",
  loginNotVerified: "The sign-in couldn't be verified.",
  badLanguage: 'Unknown language.',
  tooLarge: 'Request too large.',
  badJson: 'Invalid JSON.',
  tooManyRooms: 'Too many new rooms. Wait a minute and try again.',
  roomCreateFailed: "Couldn't create a room right now. Try again.",
  badRoomCode: 'Invalid room code.',
  expectedWebSocket: 'Expected a WebSocket.',
  noRoom: "The room doesn't exist. Check the code.",
  badPlayer: 'Invalid player.',
  roomFull: (max) => `The room is full (max ${max} players).`,
  hostOnly: 'Only the player who created the room can start.',
  badRule: 'Unknown memory rule.',
  badDevice: 'Invalid device.',
  badVote: 'Invalid vote.',
  noText: 'Write something first.',
  badKind: 'Invalid kind of suggestion.',
};

export function langOf(request: Request): Lang {
  const value = readCookie(request, LANG_COOKIE);
  return isLang(value) ? value : 'sv';
}

export function messages(lang: Lang): ServerMessages {
  return lang === 'en' ? en : sv;
}

/** Felmeddelandena på det språk förfrågan kom med. */
export function msg(request: Request): ServerMessages {
  return messages(langOf(request));
}

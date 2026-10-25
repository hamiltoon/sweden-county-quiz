-- Frivilliga konton med passkeys: en spelare som skyddat sitt namn, dess passkeys och inloggningar.

-- En spelare som skyddat sitt namn. Bara den som är inloggad som spelaren kan spara under namnet.
CREATE TABLE players (
  id TEXT PRIMARY KEY,                -- slumpat id, också WebAuthn-användar-id (base64url)
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,      -- namnet i gemener, samma som scores.name_key
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Passkeys (WebAuthn-nycklar). Bara den publika nyckeln sparas.
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,                -- credential id (base64url)
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,           -- base64url
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,                    -- JSON-lista, t.ex. ["internal","hybrid"]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT
);
CREATE INDEX passkeys_player ON passkeys (player_id);

-- Inloggningar. Bara en hash av sessionstoken sparas; själva token ligger i en HttpOnly-cookie.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_player ON sessions (player_id);

-- Engångsutmaningar för registrering och inloggning, giltiga i några minuter.
CREATE TABLE auth_challenges (
  challenge TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('register', 'login')),
  name TEXT,                          -- namnet som ska skyddas (bara vid registrering)
  player_id TEXT,                     -- spelaren som lägger till en passkey till (om inloggad)
  user_id TEXT,                       -- WebAuthn-användar-id som skickades till webbläsaren
  expires_at TEXT NOT NULL
);

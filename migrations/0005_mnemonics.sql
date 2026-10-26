-- Minnesregler (PO-33). Reglerna själva ligger i koden (src/data/mnemonics.ts); här sparas bara
-- vad spelarna tycker. Påverkar inte topplistan. `device` är ett slumpat id som enheten sparar.

-- 👍 (1) eller 👎 (-1) per regel och enhet. Man kan ändra eller ta tillbaka sin röst.
CREATE TABLE mnemonic_votes (
  rule_id TEXT NOT NULL,
  device TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (rule_id, device)
);

-- "Hjälpte minnesregeln?" efter ett rätt svar på något vars regel man sett tidigare. En gång per
-- regel och enhet; sparas skilt från rösterna.
CREATE TABLE mnemonic_helped (
  rule_id TEXT NOT NULL,
  device TEXT NOT NULL,
  helped INTEGER NOT NULL CHECK (helped IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (rule_id, device)
);

-- Kommentarer till en regel (bara på /minnesregler).
CREATE TABLE mnemonic_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  device TEXT NOT NULL,
  name TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX mnemonic_comments_rule ON mnemonic_comments (rule_id, created_at);

-- Egna förslag på regler, eller önskemål om en regel för något, som PO läser via API:t.
CREATE TABLE mnemonic_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device TEXT NOT NULL,
  name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('rule', 'wish')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

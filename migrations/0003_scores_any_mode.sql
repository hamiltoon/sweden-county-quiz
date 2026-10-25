-- Nytt läge "ort" (Fler städer). SQLite kan inte ändra en CHECK-regel, så tabellen byggs om
-- utan regeln för läget. Lägena kontrolleras i Workern (isLeaderboardMode), så nya lägen
-- behöver ingen migrering. Alla befintliga resultat kopieras över oförändrade.
CREATE TABLE scores_new (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  played_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO scores_new (id, mode, name, name_key, score, percent, played_at, created_at)
SELECT id, mode, name, name_key, score, percent, played_at, created_at FROM scores;

DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;

CREATE INDEX scores_mode_player ON scores (mode, name_key, score DESC);
CREATE INDEX scores_mode_score ON scores (mode, score DESC, played_at);

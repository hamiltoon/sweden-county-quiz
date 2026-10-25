-- Topplistan: ett resultat per avslutad omgång. Topplistan visar bästa resultat per spelare och läge.
CREATE TABLE scores (
  id TEXT PRIMARY KEY,                -- klientgenererat UUID, gör omförsök ofarliga
  mode TEXT NOT NULL CHECK (mode IN ('lan', 'stad', 'sjo', 'blandat')),
  name TEXT NOT NULL,                 -- namnet som spelaren skrev, städat
  name_key TEXT NOT NULL,             -- namnet i gemener, för att gruppera per spelare
  score INTEGER NOT NULL CHECK (score >= 0),
  percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  played_at TEXT NOT NULL,            -- när omgången spelades (ISO 8601)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX scores_mode_player ON scores (mode, name_key, score DESC);
CREATE INDEX scores_mode_score ON scores (mode, score DESC, played_at);

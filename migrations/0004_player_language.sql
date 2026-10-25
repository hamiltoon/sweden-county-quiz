-- Spelarens språk ("sv" eller "en"), så att valet följer med kontot mellan enheterna.
-- NULL betyder att inget språk har sparats än.
ALTER TABLE players ADD COLUMN language TEXT;

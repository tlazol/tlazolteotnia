CREATE TABLE reaction_counts (
  post_slug TEXT NOT NULL,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_slug, emoji)
) WITHOUT ROWID;

CREATE TABLE reaction_votes (
  visitor_hash TEXT NOT NULL,
  post_slug TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visitor_hash, post_slug, emoji)
) WITHOUT ROWID;

CREATE TRIGGER increment_reaction_count
AFTER INSERT ON reaction_votes
BEGIN
  INSERT INTO reaction_counts (post_slug, emoji, count)
  VALUES (NEW.post_slug, NEW.emoji, 1)
  ON CONFLICT (post_slug, emoji) DO UPDATE SET
    count = reaction_counts.count + 1,
    updated_at = CURRENT_TIMESTAMP;
END;

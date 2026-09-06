-- Rollback for 20260906120000_xp_event_ledger.
-- Dropping this table loses the provenance of every XP grant. UserProgress
-- .xp/.level keep their current values, so the user's visible total survives;
-- only the ability to merge or audit it is lost.
DROP TABLE IF EXISTS "XpEvent";

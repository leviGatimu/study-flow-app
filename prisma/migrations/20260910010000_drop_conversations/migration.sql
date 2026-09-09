-- Chat is withdrawn. Levi, immediately after seeing it: "forget about the chat
-- thing remove it".
--
-- The tables go with it rather than being left behind empty. A schema is a
-- claim about what the app does, and three unused tables would have every
-- future reader wondering which half of a messaging feature still runs.
--
-- The migration that created them is kept in history rather than deleted: it
-- was applied to this database, and rewriting that is how a migration folder
-- and a database stop agreeing with each other.

DROP TABLE IF EXISTS "ConversationMessage";
DROP TABLE IF EXISTS "ConversationMember";
DROP TABLE IF EXISTS "Conversation";

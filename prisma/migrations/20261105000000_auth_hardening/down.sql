-- Reverses 20261105000000_auth_hardening. Roll the app code back first: the
-- current code reads both. Dropping the counters only forgets failed attempts.
DROP TABLE "AuthThrottle";
ALTER TABLE "User" DROP COLUMN "sessionVersion";

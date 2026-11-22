-- Additive: read-only sign-ins a student makes for a mentor. Empty on a desktop:
-- mentors sign in on the website. A new table only.
CREATE TABLE "MentorAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "MentorAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MentorAccess_username_key" ON "MentorAccess"("username");
CREATE INDEX "MentorAccess_studentId_idx" ON "MentorAccess"("studentId");

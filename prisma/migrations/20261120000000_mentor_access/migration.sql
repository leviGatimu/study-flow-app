-- Additive: read-only sign-ins a student makes for a mentor. A new table only;
-- no existing row or column changes. Forward-only: old app code never reads it.
CREATE TABLE "MentorAccess" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MentorAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MentorAccess_username_key" ON "MentorAccess"("username");
CREATE INDEX "MentorAccess_studentId_idx" ON "MentorAccess"("studentId");
ALTER TABLE "MentorAccess" ADD CONSTRAINT "MentorAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

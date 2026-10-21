-- 1. Reconcile Milestone 5 columns idempotently
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "verificationType" TEXT NOT NULL DEFAULT 'MANUAL_PROOF';
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "leetcodeUsername" TEXT;
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "dailyTargetCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "HabitLog" ADD COLUMN IF NOT EXISTS "verifiedCount" INTEGER NOT NULL DEFAULT 1;

-- 2. Create User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- 3. Add userId to Habit and safely backfill any pre-existing habits
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "userId" TEXT;

DO $$
DECLARE
    default_user_id TEXT := '00000000-0000-4000-8000-000000000001';
BEGIN
    IF EXISTS (SELECT 1 FROM "Habit" WHERE "userId" IS NULL) THEN
        INSERT INTO "User" ("id", "email", "name", "passwordHash", "updatedAt")
        VALUES (
            default_user_id,
            'divy@devtrack.local',
            'Divy Patel',
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oL2.8/K2G',
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("email") DO NOTHING;

        UPDATE "Habit"
        SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'divy@devtrack.local' LIMIT 1)
        WHERE "userId" IS NULL;
    END IF;
END $$;

ALTER TABLE "Habit" ALTER COLUMN "userId" SET NOT NULL;

-- 4. Add index and foreign key constraint
CREATE INDEX IF NOT EXISTS "Habit_userId_isArchived_idx" ON "Habit"("userId", "isArchived");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Habit_userId_fkey'
    ) THEN
        ALTER TABLE "Habit"
        ADD CONSTRAINT "Habit_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
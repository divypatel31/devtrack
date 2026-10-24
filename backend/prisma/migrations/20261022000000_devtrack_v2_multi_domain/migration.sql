-- 1. Add domain column to existing Habit table (defaults to DEVELOPER, preserving all habits)
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'DEVELOPER';
CREATE INDEX IF NOT EXISTS "Habit_userId_domain_isArchived_idx" ON "Habit"("userId", "domain", "isArchived");

-- 2. Create PerformanceGoal table
CREATE TABLE IF NOT EXISTS "PerformanceGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "targetDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PerformanceGoal_userId_domain_status_idx" ON "PerformanceGoal"("userId", "domain", "status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceGoal_userId_fkey') THEN
        ALTER TABLE "PerformanceGoal"
        ADD CONSTRAINT "PerformanceGoal_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Create ActivityRecord table with server-controlled evidenceClass and deduplication constraint
CREATE TABLE IF NOT EXISTS "ActivityRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "domain" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localDate" TEXT NOT NULL,
    "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "evidenceClass" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'MANUAL',
    "evidenceUrl" TEXT,
    "evidenceNote" TEXT,
    "durationMinutes" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "movingTimeSeconds" INTEGER,
    "elapsedTimeSeconds" INTEGER,
    "elevationGainMeters" DOUBLE PRECISION,
    "avgHeartRate" DOUBLE PRECISION,
    "maxHeartRate" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActivityRecord_userId_provider_externalId_key" ON "ActivityRecord"("userId", "provider", "externalId");
CREATE INDEX IF NOT EXISTS "ActivityRecord_userId_localDate_idx" ON "ActivityRecord"("userId", "localDate");
CREATE INDEX IF NOT EXISTS "ActivityRecord_userId_domain_localDate_idx" ON "ActivityRecord"("userId", "domain", "localDate");
CREATE INDEX IF NOT EXISTS "ActivityRecord_userId_evidenceClass_idx" ON "ActivityRecord"("userId", "evidenceClass");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityRecord_userId_fkey') THEN
        ALTER TABLE "ActivityRecord"
        ADD CONSTRAINT "ActivityRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityRecord_goalId_fkey') THEN
        ALTER TABLE "ActivityRecord"
        ADD CONSTRAINT "ActivityRecord_goalId_fkey"
        FOREIGN KEY ("goalId") REFERENCES "PerformanceGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Create ProviderConnection table for encrypted OAuth tokens
CREATE TABLE IF NOT EXISTS "ProviderConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "displayName" TEXT,
    "scopes" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderConnection_userId_provider_key" ON "ProviderConnection"("userId", "provider");
CREATE INDEX IF NOT EXISTS "ProviderConnection_userId_status_idx" ON "ProviderConnection"("userId", "status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderConnection_userId_fkey') THEN
        ALTER TABLE "ProviderConnection"
        ADD CONSTRAINT "ProviderConnection_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
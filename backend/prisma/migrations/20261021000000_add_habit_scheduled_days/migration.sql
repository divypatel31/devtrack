-- AlterTable: Add scheduledDays array defaulting to all 7 days (0=Sun .. 6=Sat)
ALTER TABLE "Habit"
ADD COLUMN IF NOT EXISTS "scheduledDays" INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];
import { prisma } from '../config/db';
import { AppError, getHabitsAndAnalyticsForUser } from './habit.service';
import {
  formatDateStr,
  getDateRangeEndingAt,
  getTodayForTimezone,
  isValidCalendarDate,
  isWithinAllowedTodayWindow,
  parseTimezoneOffsetMinutes,
} from '../utils/date';

export const VALID_DOMAINS = ['DEVELOPER', 'ATHLETE', 'LEARNING'] as const;
export type PerformanceDomain = (typeof VALID_DOMAINS)[number];

export const VALID_ACTIVITY_TYPES = [
  'RUN',
  'RIDE',
  'SWIM',
  'WORKOUT',
  'DEEP_WORK',
  'CODING_SESSION',
  'LEETCODE_AC',
  'GITHUB_PUSH',
  'STUDY_SESSION',
  'READING',
  'COURSE_MODULE',
] as const;

export const VALID_METRIC_TYPES = [
  'DISTANCE_KM',
  'DURATION_MIN',
  'SESSIONS',
  'PROBLEMS',
  'PAGES',
  'COMMITS',
] as const;

export interface CreateActivityInput {
  userId: string;
  goalId?: string;
  domain: string;
  activityType: string;
  title: string;
  localDate?: string;
  timezoneOffsetMinutes?: number;
  evidenceUrl?: string;
  evidenceNote?: string;
  durationMinutes?: number;
  distanceMeters?: number;
  movingTimeSeconds?: number;
  elapsedTimeSeconds?: number;
  elevationGainMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  quantity?: number;
  unit?: string;
}

export interface VerifiedProviderActivityInput {
  userId: string;
  provider: 'STRAVA' | 'GITHUB' | 'LEETCODE';
  externalId: string;
  externalUrl?: string;
  domain: PerformanceDomain;
  activityType: string;
  title: string;
  occurredAt: Date;
  localDate: string;
  timezoneOffsetMinutes?: number;
  durationMinutes?: number;
  distanceMeters?: number;
  movingTimeSeconds?: number;
  elapsedTimeSeconds?: number;
  elevationGainMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  quantity?: number;
  unit?: string;
  evidenceNote?: string;
  metadataJson?: string;
}

export interface CreateGoalInput {
  userId: string;
  domain: string;
  title: string;
  metricType: string;
  targetValue: number;
  unit: string;
  startDate?: string;
  targetDate?: string;
}

export function validateDomain(domain: unknown): PerformanceDomain {
  if (typeof domain !== 'string' || !VALID_DOMAINS.includes(domain as PerformanceDomain)) {
    throw new AppError('Invalid domain. Must be DEVELOPER, ATHLETE, or LEARNING.', 400);
  }
  return domain as PerformanceDomain;
}

function isValidHttpsUrl(urlStr: unknown): boolean {
  if (typeof urlStr !== 'string' || urlStr.trim().length === 0) return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function computePaceSecondsPerKm(
  distanceMeters?: number | null,
  movingTimeSeconds?: number | null
): number | null {
  if (
    typeof distanceMeters !== 'number' ||
    distanceMeters <= 0 ||
    typeof movingTimeSeconds !== 'number' ||
    movingTimeSeconds <= 0
  ) {
    return null;
  }
  const km = distanceMeters / 1000;
  return Math.round(movingTimeSeconds / km);
}

/**
 * Determines whether an activity is compatible with a goal's domain and metricType,
 * and returns the numeric contribution toward that goal (or 0 if incompatible or revoked).
 */
export function getActivityGoalContribution(
  goal: { domain: string; metricType: string; startDate: string; targetDate?: string | null },
  act: {
    domain: string;
    activityType: string;
    localDate: string;
    syncStatus: string;
    distanceMeters?: number | null;
    durationMinutes?: number | null;
    movingTimeSeconds?: number | null;
    quantity?: number | null;
  }
): number {
  // Revoked provider activities or cross-domain activities must never contribute to goals
  if (act.syncStatus === 'REVOKED' || act.domain !== goal.domain) {
    return 0;
  }
  if (act.localDate < goal.startDate) {
    return 0;
  }
  if (goal.targetDate && act.localDate > goal.targetDate) {
    return 0;
  }

  switch (goal.metricType) {
    case 'DISTANCE_KM':
      return typeof act.distanceMeters === 'number' && act.distanceMeters > 0
        ? act.distanceMeters / 1000
        : 0;
    case 'DURATION_MIN': {
      if (typeof act.durationMinutes === 'number' && act.durationMinutes > 0) {
        return act.durationMinutes;
      }
      if (typeof act.movingTimeSeconds === 'number' && act.movingTimeSeconds > 0) {
        return Math.round(act.movingTimeSeconds / 60);
      }
      return 0;
    }
    case 'SESSIONS':
      return 1;
    case 'PROBLEMS':
      return act.activityType === 'LEETCODE_AC' && typeof act.quantity === 'number' && act.quantity > 0
        ? act.quantity
        : 0;
    case 'COMMITS':
      return act.activityType === 'GITHUB_PUSH' && typeof act.quantity === 'number' && act.quantity > 0
        ? act.quantity
        : 0;
    case 'PAGES':
      return act.activityType === 'READING' && typeof act.quantity === 'number' && act.quantity > 0
        ? act.quantity
        : 0;
    default:
      return 0;
  }
}

/**
 * Recalculates a PerformanceGoal's currentValue from linked non-revoked compatible activities.
 */
export async function recalculateGoalProgress(userId: string, goalId: string) {
  const goal = await prisma.performanceGoal.findFirst({
    where: { id: goalId, userId },
    include: { activities: true },
  });
  if (!goal) return null;

  let total = 0;
  for (const act of goal.activities) {
    total += getActivityGoalContribution(goal, act);
  }

  const roundedTotal = Math.round(total * 100) / 100;
  let nextStatus = goal.status;
  if (goal.status !== 'ARCHIVED') {
    nextStatus = roundedTotal >= goal.targetValue ? 'COMPLETED' : 'ACTIVE';
  }

  return prisma.performanceGoal.update({
    where: { id: goal.id },
    data: {
      currentValue: roundedTotal,
      status: nextStatus,
    },
  });
}

/**
 * Recalculates all non-archived goals for a user (used after provider sync or provider disconnect/revocation).
 */
export async function recalculateAllUserGoals(userId: string): Promise<void> {
  const goals = await prisma.performanceGoal.findMany({
    where: { userId, NOT: { status: 'ARCHIVED' } },
    select: { id: true },
  });
  for (const g of goals) {
    await recalculateGoalProgress(userId, g.id);
  }
}

function buildClassificationExplanation(row: {
  evidenceClass: string;
  provider: string;
  externalId: string | null;
  syncStatus: string;
}): string {
  if (row.evidenceClass === 'PROVIDER_VERIFIED') {
    if (row.syncStatus === 'REVOKED') {
      return `Previously imported from ${row.provider} (ID: ${row.externalId}), but provider connection was disconnected/revoked. Excluded from active verified analytics.`;
    }
    return `Authenticated server-side sync from ${row.provider} (External ID: ${row.externalId}).`;
  }
  if (row.evidenceClass === 'EVIDENCE_SUBMITTED') {
    return 'User-submitted reference link or note attached (unverified by external provider).';
  }
  return 'Self-reported session logged directly by user without external provider verification.';
}

/**
 * Logs a client-submitted activity.
 * SECURITY RULE: A client request can NEVER assign PROVIDER_VERIFIED.
 */
export async function createClientActivity(input: CreateActivityInput) {
  const domain = validateDomain(input.domain);

  if (
    typeof input.activityType !== 'string' ||
    !VALID_ACTIVITY_TYPES.includes(input.activityType as (typeof VALID_ACTIVITY_TYPES)[number])
  ) {
    throw new AppError(`Invalid activityType. Supported: ${VALID_ACTIVITY_TYPES.join(', ')}`, 400);
  }

  const cleanTitle = typeof input.title === 'string' ? input.title.trim() : '';
  if (!cleanTitle || cleanTitle.length > 140) {
    throw new AppError('Activity title is required (max 140 chars).', 400);
  }

  const tzOffset = parseTimezoneOffsetMinutes(input.timezoneOffsetMinutes, 0);
  const localDate = input.localDate || getTodayForTimezone(tzOffset);
  if (!isValidCalendarDate(localDate)) {
    throw new AppError('Invalid localDate. Expected valid YYYY-MM-DD.', 400);
  }
  if (!isWithinAllowedTodayWindow(localDate)) {
    throw new AppError(
      'Anti-cheat lock: Client activities can only be logged for the current day window.',
      403
    );
  }

  if (input.goalId) {
    const goal = await prisma.performanceGoal.findFirst({
      where: { id: input.goalId, userId: input.userId },
    });
    if (!goal) {
      throw new AppError('Target goal not found for this user.', 404);
    }
    if (goal.domain !== domain) {
      throw new AppError(
        `Cannot link a ${domain} activity to a ${goal.domain} goal.`,
        400
      );
    }
  }

  const numericFields = [
    ['durationMinutes', input.durationMinutes],
    ['distanceMeters', input.distanceMeters],
    ['movingTimeSeconds', input.movingTimeSeconds],
    ['elapsedTimeSeconds', input.elapsedTimeSeconds],
    ['elevationGainMeters', input.elevationGainMeters],
    ['avgHeartRate', input.avgHeartRate],
    ['maxHeartRate', input.maxHeartRate],
    ['quantity', input.quantity],
  ] as const;

  for (const [fieldName, val] of numericFields) {
    if (val !== undefined && val !== null) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        throw new AppError(`${fieldName} must be a non-negative number.`, 400);
      }
    }
  }

  const cleanEvidenceUrl =
    typeof input.evidenceUrl === 'string' && input.evidenceUrl.trim().length > 0
      ? input.evidenceUrl.trim()
      : null;

  if (cleanEvidenceUrl && !isValidHttpsUrl(cleanEvidenceUrl)) {
    throw new AppError('evidenceUrl must be a valid HTTP/HTTPS URL.', 400);
  }

  const cleanEvidenceNote =
    typeof input.evidenceNote === 'string' && input.evidenceNote.trim().length > 0
      ? input.evidenceNote.trim()
      : null;

  if (cleanEvidenceNote && cleanEvidenceNote.length > 500) {
    throw new AppError('evidenceNote must be 500 characters or fewer.', 400);
  }

  const hasStructuredEvidence =
    Boolean(cleanEvidenceUrl) || Boolean(cleanEvidenceNote && cleanEvidenceNote.length >= 8);
  const evidenceClass = hasStructuredEvidence ? 'EVIDENCE_SUBMITTED' : 'SELF_REPORTED';

  const created = await prisma.activityRecord.create({
    data: {
      userId: input.userId,
      goalId: input.goalId || null,
      domain,
      activityType: input.activityType,
      title: cleanTitle,
      localDate,
      timezoneOffsetMinutes: tzOffset,
      evidenceClass,
      provider: 'NONE',
      externalId: null,
      externalUrl: null,
      syncStatus: 'MANUAL',
      evidenceUrl: cleanEvidenceUrl,
      evidenceNote: cleanEvidenceNote,
      durationMinutes:
        input.durationMinutes !== undefined ? Math.round(Number(input.durationMinutes)) : null,
      distanceMeters:
        input.distanceMeters !== undefined ? Number(input.distanceMeters) : null,
      movingTimeSeconds:
        input.movingTimeSeconds !== undefined ? Math.round(Number(input.movingTimeSeconds)) : null,
      elapsedTimeSeconds:
        input.elapsedTimeSeconds !== undefined
          ? Math.round(Number(input.elapsedTimeSeconds))
          : null,
      elevationGainMeters:
        input.elevationGainMeters !== undefined ? Number(input.elevationGainMeters) : null,
      avgHeartRate: input.avgHeartRate !== undefined ? Number(input.avgHeartRate) : null,
      maxHeartRate: input.maxHeartRate !== undefined ? Number(input.maxHeartRate) : null,
      quantity: input.quantity !== undefined ? Number(input.quantity) : null,
      unit: typeof input.unit === 'string' ? input.unit.trim().slice(0, 24) : null,
    },
  });

  if (created.goalId) {
    await recalculateGoalProgress(input.userId, created.goalId);
  } else {
    // Also check if there is an active compatible goal in the same domain
    const matchingGoals = await prisma.performanceGoal.findMany({
      where: { userId: input.userId, domain, status: 'ACTIVE' },
    });
    for (const g of matchingGoals) {
      if (getActivityGoalContribution(g, created) > 0) {
        await prisma.activityRecord.update({
          where: { id: created.id },
          data: { goalId: g.id },
        });
        await recalculateGoalProgress(input.userId, g.id);
        break;
      }
    }
  }

  return {
    ...created,
    paceSecondsPerKm: computePaceSecondsPerKm(created.distanceMeters, created.movingTimeSeconds),
    classificationReason: buildClassificationExplanation(created),
  };
}

/**
 * Server-only method called exclusively by verified provider integrations (Strava, GitHub OAuth, LeetCode).
 * Enforces idempotent deduplication via @@unique([userId, provider, externalId]) and prevents
 * cross-user external event hijacking.
 */
export async function ingestVerifiedProviderActivity(input: VerifiedProviderActivityInput) {
  if (!input.externalId || !input.provider) {
    throw new AppError('Provider and externalId are required for provider-verified records.', 400);
  }
  if (!isValidCalendarDate(input.localDate)) {
    throw new AppError('Invalid localDate in provider payload.', 400);
  }

  const existingGlobal = await prisma.activityRecord.findFirst({
    where: {
      provider: input.provider,
      externalId: input.externalId,
      NOT: { userId: input.userId },
    },
  });
  if (existingGlobal) {
    throw new AppError(
      'Security violation: This external provider activity is already associated with another account.',
      409
    );
  }

  const record = await prisma.activityRecord.upsert({
    where: {
      userId_provider_externalId: {
        userId: input.userId,
        provider: input.provider,
        externalId: input.externalId,
      },
    },
    update: {
      title: input.title,
      occurredAt: input.occurredAt,
      localDate: input.localDate,
      syncStatus: 'SYNCED',
      evidenceClass: 'PROVIDER_VERIFIED',
      externalUrl: input.externalUrl || null,
      evidenceNote: input.evidenceNote || null,
      durationMinutes: input.durationMinutes ?? null,
      distanceMeters: input.distanceMeters ?? null,
      movingTimeSeconds: input.movingTimeSeconds ?? null,
      elapsedTimeSeconds: input.elapsedTimeSeconds ?? null,
      elevationGainMeters: input.elevationGainMeters ?? null,
      avgHeartRate: input.avgHeartRate ?? null,
      maxHeartRate: input.maxHeartRate ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      metadataJson: input.metadataJson ?? null,
    },
    create: {
      userId: input.userId,
      domain: input.domain,
      activityType: input.activityType,
      title: input.title,
      occurredAt: input.occurredAt,
      localDate: input.localDate,
      timezoneOffsetMinutes: input.timezoneOffsetMinutes ?? 0,
      evidenceClass: 'PROVIDER_VERIFIED',
      provider: input.provider,
      externalId: input.externalId,
      externalUrl: input.externalUrl || null,
      syncStatus: 'SYNCED',
      evidenceNote: input.evidenceNote || null,
      durationMinutes: input.durationMinutes ?? null,
      distanceMeters: input.distanceMeters ?? null,
      movingTimeSeconds: input.movingTimeSeconds ?? null,
      elapsedTimeSeconds: input.elapsedTimeSeconds ?? null,
      elevationGainMeters: input.elevationGainMeters ?? null,
      avgHeartRate: input.avgHeartRate ?? null,
      maxHeartRate: input.maxHeartRate ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      metadataJson: input.metadataJson ?? null,
    },
  });

  const activeGoals = await prisma.performanceGoal.findMany({
    where: { userId: input.userId, domain: input.domain, NOT: { status: 'ARCHIVED' } },
  });
  for (const g of activeGoals) {
    if (getActivityGoalContribution(g, record) > 0) {
      await prisma.activityRecord.update({
        where: { id: record.id },
        data: { goalId: g.id },
      });
      await recalculateGoalProgress(input.userId, g.id);
      break;
    }
  }

  return record;
}

export async function listUserActivities(
  userId: string,
  domain?: string,
  evidenceClass?: string,
  limit = 50
) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const whereClause: {
    userId: string;
    domain?: string;
    evidenceClass?: string;
  } = { userId };

  if (domain && VALID_DOMAINS.includes(domain as PerformanceDomain)) {
    whereClause.domain = domain;
  }
  if (
    evidenceClass &&
    ['PROVIDER_VERIFIED', 'EVIDENCE_SUBMITTED', 'SELF_REPORTED'].includes(evidenceClass)
  ) {
    whereClause.evidenceClass = evidenceClass;
  }

  const rows = await prisma.activityRecord.findMany({
    where: whereClause,
    orderBy: [{ localDate: 'desc' }, { occurredAt: 'desc' }],
    take: safeLimit,
  });

  return rows.map((r) => ({
    ...r,
    paceSecondsPerKm: computePaceSecondsPerKm(r.distanceMeters, r.movingTimeSeconds),
    classificationReason: buildClassificationExplanation(r),
  }));
}

export async function deleteUserActivity(userId: string, activityId: string) {
  const existing = await prisma.activityRecord.findFirst({
    where: { id: activityId, userId },
  });
  if (!existing) {
    throw new AppError('Activity record not found.', 404);
  }
  await prisma.activityRecord.delete({ where: { id: existing.id } });
  if (existing.goalId) {
    await recalculateGoalProgress(userId, existing.goalId);
  }
  return { deleted: true, id: activityId };
}

export async function createPerformanceGoal(input: CreateGoalInput) {
  const domain = validateDomain(input.domain);
  if (
    typeof input.metricType !== 'string' ||
    !VALID_METRIC_TYPES.includes(input.metricType as (typeof VALID_METRIC_TYPES)[number])
  ) {
    throw new AppError(`Invalid metricType. Supported: ${VALID_METRIC_TYPES.join(', ')}`, 400);
  }

  const cleanTitle = typeof input.title === 'string' ? input.title.trim() : '';
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new AppError('Goal title is required (max 120 chars).', 400);
  }

  const targetValue = Number(input.targetValue);
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    throw new AppError('targetValue must be a positive number.', 400);
  }

  const cleanUnit =
    typeof input.unit === 'string' && input.unit.trim().length > 0
      ? input.unit.trim().slice(0, 24)
      : 'units';

  const startDate = input.startDate || formatDateStr(new Date());
  if (!isValidCalendarDate(startDate)) {
    throw new AppError('Invalid startDate. Expected YYYY-MM-DD.', 400);
  }
  if (input.targetDate !== undefined && input.targetDate !== null && input.targetDate !== '') {
    if (!isValidCalendarDate(input.targetDate)) {
      throw new AppError('Invalid targetDate. Expected YYYY-MM-DD.', 400);
    }
  }

  return prisma.performanceGoal.create({
    data: {
      userId: input.userId,
      domain,
      title: cleanTitle,
      metricType: input.metricType,
      targetValue,
      currentValue: 0,
      unit: cleanUnit,
      startDate,
      targetDate: input.targetDate || null,
      status: 'ACTIVE',
    },
  });
}

export async function listPerformanceGoals(userId: string, domain?: string) {
  return prisma.performanceGoal.findMany({
    where: {
      userId,
      ...(domain && VALID_DOMAINS.includes(domain as PerformanceDomain) ? { domain } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deletePerformanceGoal(userId: string, goalId: string) {
  const deleted = await prisma.performanceGoal.deleteMany({
    where: { id: goalId, userId },
  });
  if (deleted.count === 0) {
    throw new AppError('Goal not found.', 404);
  }
  return { deleted: true, id: goalId };
}

/**
 * Computes the Unified Multi-Domain Performance Summary, Transparent Scoring Breakdown,
 * Athletic Personal Records, and Deterministic Weekly Review.
 * Excludes any activity with syncStatus === 'REVOKED' from verified and active totals.
 */
export async function getUnifiedPerformanceSummary(
  userId: string,
  todayStr?: string,
  timezoneOffsetMinutes?: number
) {
  const tzOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const currentDay = todayStr || getTodayForTimezone(tzOffset);
  if (!isValidCalendarDate(currentDay)) {
    throw new AppError('Invalid date format. Expected valid YYYY-MM-DD.', 400);
  }

  const last7Days = getDateRangeEndingAt(currentDay, 7);
  const last30Days = getDateRangeEndingAt(currentDay, 30);
  const last84Days = getDateRangeEndingAt(currentDay, 84);
  const start7Str = last7Days[0];
  const start30Str = last30Days[0];
  const start84Str = last84Days[0];

  const { habits, analytics: habitAnalytics } = await getHabitsAndAnalyticsForUser(
    userId,
    currentDay,
    tzOffset,
    false
  );

  const [allActivities, goals] = await Promise.all([
    prisma.activityRecord.findMany({
      where: { userId, localDate: { lte: currentDay } },
      orderBy: [{ localDate: 'desc' }, { occurredAt: 'desc' }],
    }),
    prisma.performanceGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const habitLogs84d = await prisma.habitLog.findMany({
    where: {
      completedDate: { gte: start84Str, lte: currentDay },
      habit: { userId, isArchived: false },
    },
    select: {
      completedDate: true,
      habit: { select: { domain: true } },
    },
  });

  const connections = await prisma.providerConnection.findMany({
    where: { userId },
    select: {
      provider: true,
      status: true,
      displayName: true,
      externalAccountId: true,
      lastSyncedAt: true,
      lastError: true,
    },
  });

  // Exclude REVOKED provider records from active analytics & verified counts
  const activeActivities = allActivities.filter((a) => a.syncStatus !== 'REVOKED');
  const revokedActivitiesCount = allActivities.length - activeActivities.length;

  const evidenceBreakdown = {
    providerVerifiedCount: activeActivities.filter((a) => a.evidenceClass === 'PROVIDER_VERIFIED')
      .length,
    evidenceSubmittedCount: activeActivities.filter((a) => a.evidenceClass === 'EVIDENCE_SUBMITTED')
      .length,
    selfReportedCount: activeActivities.filter((a) => a.evidenceClass === 'SELF_REPORTED').length,
    revokedCount: revokedActivitiesCount,
    totalActivities: activeActivities.length,
  };

  // Developer Domain Summary
  const devActivities7d = activeActivities.filter(
    (a) => a.domain === 'DEVELOPER' && a.localDate >= start7Str
  );
  const devDeepWorkMinutes7d = devActivities7d.reduce(
    (sum, a) => sum + (a.durationMinutes || 0),
    0
  );
  const devVerifiedEvents7d = devActivities7d.filter(
    (a) => a.evidenceClass === 'PROVIDER_VERIFIED'
  ).length;
  const leetcodeVerifiedLogs = habits
    .filter((h) => h.verificationType === 'LEETCODE')
    .reduce((sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length, 0);

  // Athlete Domain Summary & Personal Records
  const athleteActivities = activeActivities.filter((a) => a.domain === 'ATHLETE');
  const athlete7d = athleteActivities.filter((a) => a.localDate >= start7Str);
  const athlete30d = athleteActivities.filter((a) => a.localDate >= start30Str);

  const weeklyDistanceKm =
    Math.round(
      (athlete7d.reduce((s, a) => s + (a.distanceMeters || 0), 0) / 1000) * 100
    ) / 100;
  const monthlyDistanceKm =
    Math.round(
      (athlete30d.reduce((s, a) => s + (a.distanceMeters || 0), 0) / 1000) * 100
    ) / 100;
  const weeklyMovingMinutes = Math.round(
    athlete7d.reduce(
      (s, a) => s + (a.movingTimeSeconds ? a.movingTimeSeconds / 60 : a.durationMinutes || 0),
      0
    )
  );
  const weeklyElevationGainMeters = Math.round(
    athlete7d.reduce((s, a) => s + (a.elevationGainMeters || 0), 0)
  );

  const runActivities = athleteActivities.filter((a) => a.activityType === 'RUN');
  const rideActivities = athleteActivities.filter((a) => a.activityType === 'RIDE');

  const longestRunMeters = runActivities.reduce(
    (max, a) => Math.max(max, a.distanceMeters || 0),
    0
  );
  const longestRideMeters = rideActivities.reduce(
    (max, a) => Math.max(max, a.distanceMeters || 0),
    0
  );
  const highestElevationMeters = athleteActivities.reduce(
    (max, a) => Math.max(max, a.elevationGainMeters || 0),
    0
  );

  let fastestRunPaceSecPerKm: number | null = null;
  for (const r of runActivities) {
    const pace = computePaceSecondsPerKm(r.distanceMeters, r.movingTimeSeconds);
    if (pace !== null && (fastestRunPaceSecPerKm === null || pace < fastestRunPaceSecPerKm)) {
      fastestRunPaceSecPerKm = pace;
    }
  }

  // Learning Domain Summary
  const learningActivities = activeActivities.filter((a) => a.domain === 'LEARNING');
  const learning7d = learningActivities.filter((a) => a.localDate >= start7Str);
  const weeklyStudyMinutes = learning7d.reduce((s, a) => s + (a.durationMinutes || 0), 0);
  const weeklyPagesRead = learning7d
    .filter((a) => a.activityType === 'READING')
    .reduce((s, a) => s + (a.quantity || 0), 0);
  const completedModulesCount = learningActivities.filter(
    (a) => a.activityType === 'COURSE_MODULE'
  ).length;

  const activeGoalsCount = goals.filter((g) => g.status === 'ACTIVE').length;
  const completedGoalsCount = goals.filter((g) => g.status === 'COMPLETED').length;

  const insights: string[] = [];
  if (habitAnalytics.weeklyScheduledCount > 0) {
    insights.push(
      `Scheduled Habit Consistency: ${habitAnalytics.weeklyCompletedCount}/${habitAnalytics.weeklyScheduledCount} scheduled habit check-ins completed over the last 7 days (${habitAnalytics.weeklyCompletionPercentage}%). Unscheduled days are excluded from the denominator.`
    );
  }
  if (weeklyDistanceKm > 0 || weeklyMovingMinutes > 0) {
    insights.push(
      `Athlete Training Load (7d): ${weeklyDistanceKm} km across ${athlete7d.length} session(s) (${weeklyMovingMinutes} active mins, ${weeklyElevationGainMeters}m elevation).`
    );
  }
  if (weeklyStudyMinutes > 0 || weeklyPagesRead > 0) {
    insights.push(
      `Learning Velocity (7d): ${weeklyStudyMinutes} study minutes and ${weeklyPagesRead} pages logged across ${learning7d.length} session(s). Note: study duration measures time invested, not verified skill mastery.`
    );
  }
  if (evidenceBreakdown.totalActivities > 0 || revokedActivitiesCount > 0) {
    insights.push(
      `Evidence Integrity: ${evidenceBreakdown.providerVerifiedCount} active provider-verified, ${evidenceBreakdown.evidenceSubmittedCount} evidence-submitted, and ${evidenceBreakdown.selfReportedCount} self-reported activities (${revokedActivitiesCount} revoked excluded).`
    );
  }

  // Build 84-day (12-week) real activity & habit heatmap
  const heatmapMap = new Map<
    string,
    {
      date: string;
      habitCompletedCount: number;
      providerVerifiedCount: number;
      evidenceSubmittedCount: number;
      selfReportedCount: number;
      totalCount: number;
      domains: Set<string>;
    }
  >();

  for (const d of last84Days) {
    heatmapMap.set(d, {
      date: d,
      habitCompletedCount: 0,
      providerVerifiedCount: 0,
      evidenceSubmittedCount: 0,
      selfReportedCount: 0,
      totalCount: 0,
      domains: new Set<string>(),
    });
  }

  for (const hl of habitLogs84d) {
    const bucket = heatmapMap.get(hl.completedDate);
    if (bucket) {
      bucket.habitCompletedCount += 1;
      bucket.totalCount += 1;
      bucket.domains.add(hl.habit.domain || 'DEVELOPER');
    }
  }

  for (const act of activeActivities) {
    const bucket = heatmapMap.get(act.localDate);
    if (bucket) {
      if (act.evidenceClass === 'PROVIDER_VERIFIED') bucket.providerVerifiedCount += 1;
      else if (act.evidenceClass === 'EVIDENCE_SUBMITTED') bucket.evidenceSubmittedCount += 1;
      else bucket.selfReportedCount += 1;
      bucket.totalCount += 1;
      bucket.domains.add(act.domain);
    }
  }

  const activityHeatmap = last84Days.map((d) => {
    const item = heatmapMap.get(d)!;
    return {
      date: item.date,
      habitCompletedCount: item.habitCompletedCount,
      providerVerifiedCount: item.providerVerifiedCount,
      evidenceSubmittedCount: item.evidenceSubmittedCount,
      selfReportedCount: item.selfReportedCount,
      totalCount: item.totalCount,
      domains: Array.from(item.domains),
    };
  });

  // Structured Weekly Review: Cross-Domain Time Allocation, Athletic Recovery & Goal Pacing
  const totalTrackedMinutes7d =
    devDeepWorkMinutes7d + weeklyMovingMinutes + weeklyStudyMinutes;
  const timeAllocation7d = {
    developerMinutes: devDeepWorkMinutes7d,
    athleteMinutes: weeklyMovingMinutes,
    learningMinutes: weeklyStudyMinutes,
    totalMinutes: totalTrackedMinutes7d,
    developerPct:
      totalTrackedMinutes7d > 0
        ? Math.round((devDeepWorkMinutes7d / totalTrackedMinutes7d) * 100)
        : 0,
    athletePct:
      totalTrackedMinutes7d > 0
        ? Math.round((weeklyMovingMinutes / totalTrackedMinutes7d) * 100)
        : 0,
    learningPct:
      totalTrackedMinutes7d > 0
        ? Math.round((weeklyStudyMinutes / totalTrackedMinutes7d) * 100)
        : 0,
  };

  const distinctAthleteDays7d = new Set(athlete7d.map((a) => a.localDate)).size;
  const restDays7d = Math.max(0, 7 - distinctAthleteDays7d);
  const athleticRecovery7d = {
    trainingDays: distinctAthleteDays7d,
    restDays: restDays7d,
    summaryNote:
      distinctAthleteDays7d === 0
        ? 'No athletic sessions logged in the last 7 days.'
        : distinctAthleteDays7d >= 6
        ? `${distinctAthleteDays7d}/7 training days this week (${restDays7d} rest day). Consider scheduling a recovery day to support adaptation.`
        : `${distinctAthleteDays7d} active training day(s) and ${restDays7d} rest/recovery day(s) over the last 7 days.`,
  };

  const goalRecommendations = goals
    .filter((g) => g.status !== 'ARCHIVED')
    .map((g) => {
      const progressPct = Math.min(
        100,
        Math.round((g.currentValue / Math.max(g.targetValue, 1)) * 100)
      );
      const remaining = Math.max(0, Math.round((g.targetValue - g.currentValue) * 100) / 100);
      let recommendation = `On track: ${g.currentValue}/${g.targetValue} ${g.unit} (${progressPct}%).`;
      if (g.status === 'COMPLETED' || progressPct >= 100) {
        recommendation = `Milestone reached (${g.currentValue}/${g.targetValue} ${g.unit})! Consider archiving or raising your target by 10-15%.`;
      } else if (progressPct < 25) {
        recommendation = `Early stage (${progressPct}% complete, ${remaining} ${g.unit} remaining). Break this goal into smaller scheduled weekly sessions.`;
      } else {
        recommendation = `Steady progress (${progressPct}% complete). ${remaining} ${g.unit} remaining to hit target.`;
      }
      return {
        goalId: g.id,
        title: g.title,
        domain: g.domain,
        progressPct,
        recommendation,
      };
    });

  return {
    todayStr: currentDay,
    transparentScoring: {
      formulaExplanation:
        'Scheduled Habit Consistency = (Completed Scheduled Habit-Days / Total Active Scheduled Habit-Days) * 100. Unscheduled rest days are never counted as missed. Multiple activities on the same day do not inflate daily habit consistency. Self-reported check-ins and revoked provider records are excluded from provider-verified metrics.',
      scheduledHabitConsistency7dPct: habitAnalytics.weeklyCompletionPercentage,
      scheduledHabitConsistency30dPct: habitAnalytics.thirtyDayCompletionPercentage,
      scheduledHabitDenominator7d: `${habitAnalytics.weeklyCompletedCount}/${habitAnalytics.weeklyScheduledCount}`,
      scheduledHabitDenominator30d: `${habitAnalytics.thirtyDayCompletedCount}/${habitAnalytics.thirtyDayScheduledCount}`,
      evidenceBreakdown,
      goalsProgress: {
        activeGoalsCount,
        completedGoalsCount,
        totalGoalsCount: goals.length,
      },
    },
    domains: {
      developer: {
        activeHabitsCount: habits.filter((h) => (h.domain || 'DEVELOPER') === 'DEVELOPER').length,
        deepWorkMinutes7d: devDeepWorkMinutes7d,
        verifiedProviderEvents7d: devVerifiedEvents7d + leetcodeVerifiedLogs,
        totalActivities7d: devActivities7d.length,
      },
      athlete: {
        weeklyDistanceKm,
        monthlyDistanceKm,
        weeklyMovingMinutes,
        weeklyElevationGainMeters,
        sessions7d: athlete7d.length,
        personalRecords: {
          longestRunKm:
            longestRunMeters > 0 ? Math.round((longestRunMeters / 1000) * 100) / 100 : null,
          longestRideKm:
            longestRideMeters > 0 ? Math.round((longestRideMeters / 1000) * 100) / 100 : null,
          highestElevationMeters: highestElevationMeters > 0 ? highestElevationMeters : null,
          fastestRunPaceSecPerKm,
        },
      },
      learning: {
        weeklyStudyMinutes,
        weeklyPagesRead,
        completedModulesCount,
        sessions7d: learning7d.length,
      },
    },
    activityHeatmap,
    weeklyReview: {
      timeAllocation7d,
      athleticRecovery7d,
      goalRecommendations,
    },
    insights,
    connections,
  };
}
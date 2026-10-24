export type PerformanceDomain = 'DEVELOPER' | 'ATHLETE' | 'LEARNING';

export type EvidenceClass =
  | 'PROVIDER_VERIFIED'
  | 'EVIDENCE_SUBMITTED'
  | 'SELF_REPORTED';

export interface ActivityRecord {
  id: string;
  userId: string;
  goalId: string | null;
  domain: PerformanceDomain;
  activityType: string;
  title: string;
  occurredAt: string;
  localDate: string;
  timezoneOffsetMinutes: number;
  evidenceClass: EvidenceClass;
  provider: 'NONE' | 'STRAVA' | 'GITHUB' | 'LEETCODE';
  externalId: string | null;
  externalUrl: string | null;
  syncStatus: 'SYNCED' | 'STALE' | 'REVOKED' | 'MANUAL';
  evidenceUrl: string | null;
  evidenceNote: string | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
  movingTimeSeconds: number | null;
  elapsedTimeSeconds: number | null;
  elevationGainMeters: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  quantity: number | null;
  unit: string | null;
  paceSecondsPerKm: number | null;
  classificationReason: string;
}

export interface PerformanceGoal {
  id: string;
  userId: string;
  domain: PerformanceDomain;
  title: string;
  metricType: 'DISTANCE_KM' | 'DURATION_MIN' | 'SESSIONS' | 'PROBLEMS' | 'PAGES' | 'COMMITS';
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
}

export interface ProviderStatusItem {
  provider: 'STRAVA' | 'GITHUB';
  oauthConfiguredOnServer: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'REVOKED' | 'ERROR' | 'UNCONFIGURED';
  displayName: string | null;
  externalAccountId: string | null;
  scopes?: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface ProviderStatuses {
  strava: ProviderStatusItem;
  github: ProviderStatusItem;
}

export interface ActivityHeatmapPoint {
  date: string;
  habitCompletedCount: number;
  providerVerifiedCount: number;
  evidenceSubmittedCount: number;
  selfReportedCount: number;
  totalCount: number;
  domains: string[];
}

export interface UnifiedPerformanceSummary {
  todayStr: string;
  transparentScoring: {
    formulaExplanation: string;
    scheduledHabitConsistency7dPct: number;
    scheduledHabitConsistency30dPct: number;
    scheduledHabitDenominator7d: string;
    scheduledHabitDenominator30d: string;
    evidenceBreakdown: {
      providerVerifiedCount: number;
      evidenceSubmittedCount: number;
      selfReportedCount: number;
      revokedCount?: number;
      totalActivities: number;
    };
    goalsProgress: {
      activeGoalsCount: number;
      completedGoalsCount: number;
      totalGoalsCount: number;
    };
  };
  domains: {
    developer: {
      activeHabitsCount: number;
      deepWorkMinutes7d: number;
      verifiedProviderEvents7d: number;
      totalActivities7d: number;
    };
    athlete: {
      weeklyDistanceKm: number;
      monthlyDistanceKm: number;
      weeklyMovingMinutes: number;
      weeklyElevationGainMeters: number;
      sessions7d: number;
      personalRecords: {
        longestRunKm: number | null;
        longestRideKm: number | null;
        highestElevationMeters: number | null;
        fastestRunPaceSecPerKm: number | null;
      };
    };
    learning: {
      weeklyStudyMinutes: number;
      weeklyPagesRead: number;
      completedModulesCount: number;
      sessions7d: number;
    };
  };
  activityHeatmap?: ActivityHeatmapPoint[];
  weeklyReview?: {
    timeAllocation7d: {
      developerMinutes: number;
      athleteMinutes: number;
      learningMinutes: number;
      totalMinutes: number;
      developerPct: number;
      athletePct: number;
      learningPct: number;
    };
    athleticRecovery7d: {
      trainingDays: number;
      restDays: number;
      summaryNote: string;
    };
    goalRecommendations: Array<{
      goalId: string;
      title: string;
      domain: string;
      progressPct: number;
      recommendation: string;
    }>;
  };
  insights: string[];
}
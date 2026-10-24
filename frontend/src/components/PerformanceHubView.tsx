import { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileCheck2,
  HeartPulse,
  Info,
  Link2,
  Link2Off,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  fetchPerformanceSummary,
  fetchActivities,
  createActivity,
  deleteActivity,
  fetchGoals,
  createGoal,
  deleteGoal,
  initiateStravaConnect,
  initiateGitHubConnect,
  syncStravaActivitiesApi,
  syncGitHubEventsApi,
  disconnectProviderApi,
} from '../api/performance';
import type {
  ActivityRecord,
  EvidenceClass,
  PerformanceDomain,
  PerformanceGoal,
  ProviderStatuses,
  UnifiedPerformanceSummary,
} from '../types/performance';

interface PerformanceHubViewProps {
  todayStr: string;
  initialMode?: 'OVERVIEW' | PerformanceDomain;
}

function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || secondsPerKm <= 0) return 'N/A';
  const mins = Math.floor(secondsPerKm / 60);
  const secs = String(secondsPerKm % 60).padStart(2, '0');
  return `${mins}:${secs} /km`;
}

function getEvidenceBadge(evidenceClass: EvidenceClass, provider: string, syncStatus?: string) {
  if (evidenceClass === 'PROVIDER_VERIFIED' && syncStatus === 'REVOKED') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <Info className="w-3 h-3" /> Disconnected ({provider} - Excluded)
      </span>
    );
  }
  if (evidenceClass === 'PROVIDER_VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3 h-3" /> Verified by {provider}
      </span>
    );
  }
  if (evidenceClass === 'EVIDENCE_SUBMITTED') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <FileCheck2 className="w-3 h-3" /> Evidence Attached
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Info className="w-3 h-3" /> Self-Reported
    </span>
  );
}

export function PerformanceHubView({
  todayStr,
  initialMode = 'OVERVIEW',
}: PerformanceHubViewProps) {
  const [activeMode, setActiveMode] = useState<'OVERVIEW' | PerformanceDomain>(initialMode);
  const [summary, setSummary] = useState<UnifiedPerformanceSummary | null>(null);
  const [providers, setProviders] = useState<ProviderStatuses | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [evidenceFilter, setEvidenceFilter] = useState<string>('');
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

  // Activity Logger Form State
  const [actDomain, setActDomain] = useState<PerformanceDomain>('ATHLETE');
  const [actType, setActType] = useState<string>('RUN');
  const [actTitle, setActTitle] = useState<string>('');
  const [actDurationMin, setActDurationMin] = useState<string>('45');
  const [actDistanceKm, setActDistanceKm] = useState<string>('5');
  const [actElevationM, setActElevationM] = useState<string>('');
  const [actAvgHr, setActAvgHr] = useState<string>('');
  const [actQuantity, setActQuantity] = useState<string>('');
  const [actUnit, setActUnit] = useState<string>('pages');
  const [actEvidenceUrl, setActEvidenceUrl] = useState<string>('');
  const [actEvidenceNote, setActEvidenceNote] = useState<string>('');
  const [submittingActivity, setSubmittingActivity] = useState<boolean>(false);

  // Goal Form State
  const [showGoalForm, setShowGoalForm] = useState<boolean>(false);
  const [goalDomain, setGoalDomain] = useState<PerformanceDomain>('ATHLETE');
  const [goalTitle, setGoalTitle] = useState<string>('');
  const [goalMetric, setGoalMetric] = useState<string>('DISTANCE_KM');
  const [goalTarget, setGoalTarget] = useState<string>('50');
  const [goalUnit, setGoalUnit] = useState<string>('km');
  const [submittingGoal, setSubmittingGoal] = useState<boolean>(false);

  function handleSelectMode(nextMode: 'OVERVIEW' | PerformanceDomain) {
    setActiveMode(nextMode);
    if (nextMode !== 'OVERVIEW') {
      setActDomain(nextMode);
      setGoalDomain(nextMode);
      if (nextMode === 'DEVELOPER') {
        setActType('DEEP_WORK');
        setGoalMetric('DURATION_MIN');
        setGoalUnit('mins');
      } else if (nextMode === 'ATHLETE') {
        setActType('RUN');
        setGoalMetric('DISTANCE_KM');
        setGoalUnit('km');
      } else if (nextMode === 'LEARNING') {
        setActType('STUDY_SESSION');
        setGoalMetric('DURATION_MIN');
        setGoalUnit('mins');
      }
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadHubData() {
      setLoading(true);
      setError(null);
      try {
        const domainFilter = activeMode === 'OVERVIEW' ? undefined : activeMode;
        const [summaryResp, actsResp, goalsResp] = await Promise.all([
          fetchPerformanceSummary(todayStr),
          fetchActivities(domainFilter, evidenceFilter || undefined),
          fetchGoals(domainFilter),
        ]);

        if (!isCancelled) {
          setSummary(summaryResp.summary);
          setProviders(summaryResp.providers);
          setActivities(actsResp);
          setGoals(goalsResp);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load Performance Hub');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadHubData();
    return () => {
      isCancelled = true;
    };
  }, [todayStr, activeMode, evidenceFilter, reloadTick]);

  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actTitle.trim()) return;
    setSubmittingActivity(true);
    setError(null);
    setStatusMsg(null);
    try {
      const distKm = Number(actDistanceKm);
      const durMin = Number(actDurationMin);
      const isAthleticDist = actType === 'RUN' || actType === 'RIDE' || actType === 'SWIM';

      const created = await createActivity({
        domain: actDomain,
        activityType: actType,
        title: actTitle.trim(),
        localDate: todayStr,
        durationMinutes: durMin > 0 ? durMin : undefined,
        movingTimeSeconds: durMin > 0 ? durMin * 60 : undefined,
        distanceMeters: isAthleticDist && distKm > 0 ? Math.round(distKm * 1000) : undefined,
        elevationGainMeters:
          actElevationM.trim() !== '' && Number(actElevationM) >= 0
            ? Number(actElevationM)
            : undefined,
        avgHeartRate:
          actAvgHr.trim() !== '' && Number(actAvgHr) > 0 ? Number(actAvgHr) : undefined,
        quantity:
          actQuantity.trim() !== '' && Number(actQuantity) > 0
            ? Number(actQuantity)
            : undefined,
        unit: actUnit.trim() || undefined,
        evidenceUrl: actEvidenceUrl.trim() || undefined,
        evidenceNote: actEvidenceNote.trim() || undefined,
      });

      setActTitle('');
      setActEvidenceUrl('');
      setActEvidenceNote('');
      setStatusMsg(
        `Session "${created.title}" saved (${created.evidenceClass.replace('_', ' ')}).`
      );
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session');
    } finally {
      setSubmittingActivity(false);
    }
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    setSubmittingGoal(true);
    setError(null);
    try {
      await createGoal({
        domain: goalDomain,
        title: goalTitle.trim(),
        metricType: goalMetric,
        targetValue: Number(goalTarget),
        unit: goalUnit.trim() || 'units',
        startDate: todayStr,
      });
      setGoalTitle('');
      setShowGoalForm(false);
      setStatusMsg('Goal created. Matching activities will automatically update your progress.');
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create goal');
    } finally {
      setSubmittingGoal(false);
    }
  }

  async function handleStravaConnectClick() {
    setError(null);
    setStatusMsg(null);
    try {
      const res = await initiateStravaConnect();
      if (!res.configured || !res.authorizationUrl) {
        setError(
          res.message ||
            'Strava OAuth is not configured on this server yet. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in backend/.env.'
        );
        return;
      }
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate Strava connection');
    }
  }

  async function handleStravaSync() {
    setSyncingProvider('STRAVA');
    setError(null);
    try {
      const res = await syncStravaActivitiesApi();
      setStatusMsg(`Synced ${res.syncedCount} verified Strava activities.`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strava sync failed');
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleGitHubConnectClick() {
    setError(null);
    setStatusMsg(null);
    try {
      const res = await initiateGitHubConnect();
      if (!res.configured || !res.authorizationUrl) {
        setError(
          res.message ||
            'GitHub OAuth is not configured on this server yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.'
        );
        return;
      }
      window.location.href = res.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate GitHub connection');
    }
  }

  async function handleGitHubSync() {
    setSyncingProvider('GITHUB');
    setError(null);
    try {
      const res = await syncGitHubEventsApi();
      setStatusMsg(`Synced ${res.syncedCount} verified GitHub events for @${res.username}.`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub sync failed');
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleDisconnect(provider: 'STRAVA' | 'GITHUB') {
    setError(null);
    try {
      await disconnectProviderApi(provider, false);
      setStatusMsg(`Disconnected ${provider} and updated your goal progress.`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to disconnect ${provider}`);
    }
  }

  const displayedActivities = selectedHeatmapDate
    ? activities.filter((a) => a.localDate === selectedHeatmapDate)
    : activities;

  const heatmapPoints = summary?.activityHeatmap || [];
  const timeAlloc = summary?.weeklyReview?.timeAllocation7d;

  return (
    <div className="space-y-6">
      {/* Domain Mode Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
            Multi-Domain Progress
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Track anything. Verify what matters. Measure real progress.
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Performance Domains"
          className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
        >
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: Sparkles },
            { id: 'DEVELOPER', label: 'Developer', icon: Code2 },
            { id: 'ATHLETE', label: 'Athlete', icon: HeartPulse },
            { id: 'LEARNING', label: 'Learning', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => handleSelectMode(tab.id as 'OVERVIEW' | PerformanceDomain)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {statusMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {statusMsg}
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* INTERACTIVE TRANSPARENT SCORING & EVIDENCE DRILLDOWN CARDS */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">
              Habit Consistency (7d)
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {summary.transparentScoring.scheduledHabitConsistency7dPct}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.transparentScoring.scheduledHabitDenominator7d} scheduled days (30d:{' '}
              {summary.transparentScoring.scheduledHabitConsistency30dPct}%)
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setEvidenceFilter((prev) =>
                prev === 'PROVIDER_VERIFIED' ? '' : 'PROVIDER_VERIFIED'
              )
            }
            className={`bg-white border rounded-2xl p-5 text-left transition cursor-pointer shadow-xs ${
              evidenceFilter === 'PROVIDER_VERIFIED'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-slate-200/90 hover:border-emerald-300'
            }`}
          >
            <span className="text-xs font-semibold text-emerald-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Provider Verified
              </span>
              <span className="text-[11px] text-emerald-600 underline">Filter</span>
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {summary.transparentScoring.evidenceBreakdown.providerVerifiedCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Synced from connected accounts
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setEvidenceFilter((prev) =>
                prev === 'EVIDENCE_SUBMITTED' ? '' : 'EVIDENCE_SUBMITTED'
              )
            }
            className={`bg-white border rounded-2xl p-5 text-left transition cursor-pointer shadow-xs ${
              evidenceFilter === 'EVIDENCE_SUBMITTED'
                ? 'border-amber-500 ring-2 ring-amber-500/20'
                : 'border-slate-200/90 hover:border-amber-300'
            }`}
          >
            <span className="text-xs font-semibold text-amber-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-amber-600" /> Evidence Attached
              </span>
              <span className="text-[11px] text-amber-600 underline">Filter</span>
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {summary.transparentScoring.evidenceBreakdown.evidenceSubmittedCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Includes user-submitted links or notes
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setEvidenceFilter((prev) => (prev === 'SELF_REPORTED' ? '' : 'SELF_REPORTED'))
            }
            className={`bg-white border rounded-2xl p-5 text-left transition cursor-pointer shadow-xs ${
              evidenceFilter === 'SELF_REPORTED'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <span className="text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400" /> Self-Reported
              </span>
              <span className="text-[11px] text-indigo-600 underline">Filter</span>
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {summary.transparentScoring.evidenceBreakdown.selfReportedCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Logged directly without external link
            </p>
          </button>
        </div>
      )}

      {/* 12-WEEK (84-DAY) MULTI-DOMAIN ACTIVITY HEATMAP */}
      {heatmapPoints.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                12-Week Activity Overview (Last 84 Days)
              </h3>
              <p className="text-xs text-slate-500">
                Combines completed habits and recorded sessions. Select any day to filter the
                activity feed below.
              </p>
            </div>
            {selectedHeatmapDate && (
              <button
                type="button"
                onClick={() => setSelectedHeatmapDate(null)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Date: {selectedHeatmapDate}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-12 sm:grid-cols-21 lg:grid-cols-28 gap-1.5 tabular-nums">
            {heatmapPoints.map((pt) => {
              const isSelected = selectedHeatmapDate === pt.date;
              let colorClass = 'bg-slate-50 border-slate-200/70 text-slate-400 hover:border-slate-300';
              if (pt.providerVerifiedCount > 0) {
                colorClass = 'bg-emerald-100 border-emerald-300 text-emerald-900 font-semibold';
              } else if (pt.totalCount >= 2) {
                colorClass = 'bg-indigo-600 border-indigo-600 text-white font-semibold';
              } else if (pt.totalCount === 1) {
                colorClass = 'bg-indigo-100 border-indigo-200 text-indigo-900 font-medium';
              }

              return (
                <button
                  key={pt.date}
                  type="button"
                  onClick={() =>
                    setSelectedHeatmapDate((prev) => (prev === pt.date ? null : pt.date))
                  }
                  title={`${pt.date}: ${pt.totalCount} total (${pt.providerVerifiedCount} provider-verified, ${pt.habitCompletedCount} habits)`}
                  aria-label={`${pt.date}: ${pt.totalCount} activities`}
                  className={`h-7 rounded-md border text-[9.5px] flex items-center justify-center transition cursor-pointer ${colorClass} ${
                    isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                  }`}
                >
                  {pt.date.slice(8)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ATHLETE MODE & STRAVA INTEGRATION PANEL */}
      {(activeMode === 'OVERVIEW' || activeMode === 'ATHLETE') && summary && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Athlete Mode & Strava
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      providers?.strava.status === 'CONNECTED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {providers?.strava.status || 'DISCONNECTED'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {providers?.strava.status === 'CONNECTED'
                    ? `Connected as ${providers.strava.displayName || 'Strava Athlete'}. Unrecorded sensor metrics (such as heart rate) remain blank.`
                    : providers?.strava.oauthConfiguredOnServer
                    ? 'Connect your Strava account to import verified runs, rides, and workouts.'
                    : 'To enable live Strava OAuth, add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in backend/.env.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {providers?.strava.status === 'CONNECTED' ? (
                <>
                  <button
                    type="button"
                    disabled={syncingProvider === 'STRAVA'}
                    onClick={handleStravaSync}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        syncingProvider === 'STRAVA' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Sync Activities</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect('STRAVA')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2Off className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStravaConnectClick}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Connect Strava</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-1 tabular-nums">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] text-slate-500">7d Distance</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.weeklyDistanceKm} km
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] text-slate-500">30d Distance</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.monthlyDistanceKm} km
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] text-slate-500">7d Moving Time</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.weeklyMovingMinutes} min
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="text-[11px] text-slate-500">7d Elevation</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.weeklyElevationGainMeters} m
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/70">
              <div className="text-[11px] text-orange-700 font-medium flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Longest Run
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.personalRecords.longestRunKm !== null
                  ? `${summary.domains.athlete.personalRecords.longestRunKm} km`
                  : 'No data'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/70">
              <div className="text-[11px] text-orange-700 font-medium flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Longest Ride
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.personalRecords.longestRideKm !== null
                  ? `${summary.domains.athlete.personalRecords.longestRideKm} km`
                  : 'No data'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/70">
              <div className="text-[11px] text-orange-700 font-medium">Best Run Pace</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {formatPace(summary.domains.athlete.personalRecords.fastestRunPaceSecPerKm)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/70">
              <div className="text-[11px] text-orange-700 font-medium">Max Elevation</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {summary.domains.athlete.personalRecords.highestElevationMeters !== null
                  ? `${summary.domains.athlete.personalRecords.highestElevationMeters} m`
                  : 'No data'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER & LEARNING DOMAIN SUMMARY ROW */}
      {(activeMode === 'OVERVIEW' || activeMode === 'DEVELOPER' || activeMode === 'LEARNING') &&
        summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 tabular-nums">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Developer Mode & GitHub
                    </h3>
                    <p className="text-xs text-slate-500">
                      Deep-work sessions, LeetCode check-ins, and verified GitHub events
                    </p>
                  </div>
                </div>
                {providers?.github.status === 'CONNECTED' && (
                  <button
                    type="button"
                    onClick={() => handleDisconnect('GITHUB')}
                    className="text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                  >
                    Disconnect {providers.github.displayName}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">7d Deep Work</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {summary.domains.developer.deepWorkMinutes7d} min
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">7d Verified Events</div>
                  <div className="text-lg font-bold text-emerald-600 mt-0.5">
                    {summary.domains.developer.verifiedProviderEvents7d}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Active Habits</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {summary.domains.developer.activeHabitsCount}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-500">
                  {providers?.github.status === 'CONNECTED'
                    ? `Connected account: ${providers.github.displayName}`
                    : providers?.github.oauthConfiguredOnServer
                    ? 'Connect GitHub via OAuth to verify your repository activity.'
                    : 'To enable GitHub OAuth, add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.'}
                </span>
                {providers?.github.status === 'CONNECTED' ? (
                  <button
                    type="button"
                    disabled={syncingProvider === 'GITHUB'}
                    onClick={handleGitHubSync}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    {syncingProvider === 'GITHUB' ? 'Syncing...' : 'Sync GitHub Events'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGitHubConnectClick}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Connect GitHub</span>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Learning Mode & Study Log
                  </h3>
                  <p className="text-xs text-slate-500">
                    Track reading sessions, course modules, and study notes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">7d Study Time</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {summary.domains.learning.weeklyStudyMinutes} min
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">7d Pages Read</div>
                  <div className="text-lg font-bold text-teal-700 mt-0.5">
                    {summary.domains.learning.weeklyPagesRead} pages
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Course Modules</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {summary.domains.learning.completedModulesCount}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                Study time tracks your investment, while attaching a certificate or project link
                marks a completed module as Evidence Attached.
              </p>
            </div>
          </div>
        )}

      {/* MAIN WORKSPACE: LEFT = LOG ACTIVITY & GOALS | RIGHT = WEEKLY REVIEW & UNIFIED TIMELINE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Log a Session ({todayStr})</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Record a workout, deep-work block, or study session. Add a link or note to attach
              supporting evidence.
            </p>

            <form onSubmit={handleLogActivity} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Domain
                  </label>
                  <select
                    value={actDomain}
                    onChange={(e) => setActDomain(e.target.value as PerformanceDomain)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="ATHLETE">Athlete</option>
                    <option value="LEARNING">Learning</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Session Type
                  </label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    {actDomain === 'ATHLETE' && (
                      <>
                        <option value="RUN">Run</option>
                        <option value="RIDE">Cycling Ride</option>
                        <option value="SWIM">Swim</option>
                        <option value="WORKOUT">Strength / Workout</option>
                      </>
                    )}
                    {actDomain === 'DEVELOPER' && (
                      <>
                        <option value="DEEP_WORK">Deep-Work Architecture</option>
                        <option value="CODING_SESSION">Coding Session</option>
                      </>
                    )}
                    {actDomain === 'LEARNING' && (
                      <>
                        <option value="STUDY_SESSION">Focused Study</option>
                        <option value="READING">Book Reading</option>
                        <option value="COURSE_MODULE">Course Module</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder={
                    actDomain === 'ATHLETE'
                      ? 'e.g., Morning 5K Run'
                      : actDomain === 'LEARNING'
                      ? 'e.g., Read Designing Data-Intensive Applications Ch. 5'
                      : 'e.g., Refactored API authentication middleware'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900"
                />
              </div>

              {actDomain === 'ATHLETE' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={actDistanceKm}
                      onChange={(e) => setActDistanceKm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={actDurationMin}
                      onChange={(e) => setActDurationMin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Elevation (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Optional"
                      value={actElevationM}
                      onChange={(e) => setActElevationM(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Avg HR (bpm)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="230"
                      placeholder="Optional"
                      value={actAvgHr}
                      onChange={(e) => setActAvgHr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={actDurationMin}
                      onChange={(e) => setActDurationMin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Optional"
                      value={actQuantity}
                      onChange={(e) => setActQuantity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={actUnit}
                      onChange={(e) => setActUnit(e.target.value)}
                      placeholder="pages / modules"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Reference Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={actEvidenceUrl}
                    onChange={(e) => setActEvidenceUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Session Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={actEvidenceNote}
                    onChange={(e) => setActEvidenceNote(e.target.value)}
                    placeholder="Key takeaway or summary..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingActivity}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                {submittingActivity ? 'Saving session...' : 'Save Session'}
              </button>
            </form>
          </div>

          {/* Measurable Outcome Goals Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Outcome Goals ({goals.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Progress updates automatically when matching sessions are logged
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGoalForm((s) => !s)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-700 flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Goal
              </button>
            </div>

            {showGoalForm && (
              <form
                onSubmit={handleCreateGoal}
                className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <input
                  type="text"
                  required
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g., Run 40 km this month or Read 200 pages"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={goalDomain}
                    onChange={(e) => setGoalDomain(e.target.value as PerformanceDomain)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value="ATHLETE">Athlete</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="LEARNING">Learning</option>
                  </select>
                  <select
                    value={goalMetric}
                    onChange={(e) => setGoalMetric(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value="DISTANCE_KM">Distance (km)</option>
                    <option value="DURATION_MIN">Duration (min)</option>
                    <option value="PAGES">Pages Read</option>
                    <option value="SESSIONS">Sessions</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    required
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    placeholder="Target"
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGoalForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGoal}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Create Goal
                  </button>
                </div>
              </form>
            )}

            {goals.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs font-medium text-slate-700">No active goals yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Set a measurable target for distance, deep-work minutes, or pages read to track
                  long-term milestones.
                </p>
              </div>
            ) : (
              <div className="space-y-3 tabular-nums">
                {goals.map((g) => {
                  const pct = Math.min(
                    100,
                    Math.round((g.currentValue / Math.max(g.targetValue, 1)) * 100)
                  );
                  return (
                    <div
                      key={g.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-indigo-600 mr-2">
                            {g.domain}
                          </span>
                          <strong className="text-slate-900">{g.title}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {g.currentValue} / {g.targetValue} {g.unit} ({pct}%)
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete goal ${g.title}`}
                            onClick={async () => {
                              await deleteGoal(g.id);
                              setReloadTick((t) => t + 1);
                            }}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Cols: Structured Weekly Review + Unified Activity & Evidence Feed */}
        <div className="xl:col-span-7 space-y-6">
          {summary && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Weekly Review & Scoring Breakdown</span>
                </h3>
                <span className="text-[11px] font-medium text-slate-400">
                  Transparent Calculation
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                {summary.transparentScoring.formulaExplanation}
              </p>

              {timeAlloc && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 tabular-nums">
                  <div className="flex flex-wrap items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      7-Day Active Time ({timeAlloc.totalMinutes} mins)
                    </span>
                    <span className="text-slate-500">
                      Dev: {timeAlloc.developerMinutes}m ({timeAlloc.developerPct}%) {"\u2022"}{' '}
                      Athlete: {timeAlloc.athleteMinutes}m ({timeAlloc.athletePct}%) {"\u2022"}{' '}
                      Learning: {timeAlloc.learningMinutes}m ({timeAlloc.learningPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      style={{ width: `${timeAlloc.developerPct}%` }}
                      className="bg-indigo-600 h-full"
                    />
                    <div
                      style={{ width: `${timeAlloc.athletePct}%` }}
                      className="bg-orange-500 h-full"
                    />
                    <div
                      style={{ width: `${timeAlloc.learningPct}%` }}
                      className="bg-teal-500 h-full"
                    />
                  </div>
                </div>
              )}

              {summary.weeklyReview && (
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">{"\u2022"}</span>
                    <span>
                      <strong>Training & Rest Balance:</strong>{' '}
                      {summary.weeklyReview.athleticRecovery7d.summaryNote}
                    </span>
                  </div>
                  {summary.weeklyReview.goalRecommendations.map((gr) => (
                    <div key={gr.goalId} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">{"\u2022"}</span>
                      <span>
                        <strong>{gr.title}:</strong> {gr.recommendation}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {summary.insights.length > 0 && (
                <ul className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  {summary.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">{"\u2022"}</span>
                      <span>{ins}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Activity Timeline with Evidence Filter */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Activity & Evidence Feed ({displayedActivities.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Every session displays its verification tier and source details
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Filter by evidence classification"
                  value={evidenceFilter}
                  onChange={(e) => setEvidenceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">All Evidence Tiers</option>
                  <option value="PROVIDER_VERIFIED">Provider Verified</option>
                  <option value="EVIDENCE_SUBMITTED">Evidence Attached</option>
                  <option value="SELF_REPORTED">Self-Reported</option>
                </select>
                {(evidenceFilter || selectedHeatmapDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFilter('');
                      setSelectedHeatmapDate(null);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200/60"
                  />
                ))}
              </div>
            ) : displayedActivities.length === 0 ? (
              <div className="py-12 text-center">
                <Timer className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-900">No sessions in this view yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Log a session using the form on the left or sync a connected provider account to
                  build your activity timeline.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1 tabular-nums">
                {displayedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10.5px] font-bold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {act.domain} {"\u2022"} {act.activityType}
                        </span>
                        {getEvidenceBadge(act.evidenceClass, act.provider, act.syncStatus)}
                        <span className="text-xs text-slate-500">{act.localDate}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete activity ${act.title}`}
                        onClick={async () => {
                          await deleteActivity(act.id);
                          setReloadTick((t) => t + 1);
                        }}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-sm font-bold text-slate-900">{act.title}</div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      {act.distanceMeters !== null && act.distanceMeters > 0 && (
                        <span>
                          Distance:{' '}
                          <strong className="text-slate-900">
                            {Math.round((act.distanceMeters / 1000) * 100) / 100} km
                          </strong>
                        </span>
                      )}
                      {act.durationMinutes !== null && act.durationMinutes > 0 && (
                        <span>
                          Duration:{' '}
                          <strong className="text-slate-900">{act.durationMinutes} min</strong>
                        </span>
                      )}
                      {act.paceSecondsPerKm !== null && (
                        <span>
                          Pace:{' '}
                          <strong className="text-slate-900">
                            {formatPace(act.paceSecondsPerKm)}
                          </strong>
                        </span>
                      )}
                      {act.elevationGainMeters !== null && (
                        <span>
                          Elevation:{' '}
                          <strong className="text-slate-900">{act.elevationGainMeters} m</strong>
                        </span>
                      )}
                      {act.avgHeartRate !== null && (
                        <span>
                          Avg HR:{' '}
                          <strong className="text-slate-900">{act.avgHeartRate} bpm</strong>
                        </span>
                      )}
                      {act.quantity !== null && (
                        <span>
                          Amount:{' '}
                          <strong className="text-slate-900">
                            {act.quantity} {act.unit || ''}
                          </strong>
                        </span>
                      )}
                    </div>

                    {(act.evidenceNote || act.evidenceUrl || act.externalUrl) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1.5 border-t border-slate-200/70">
                        {act.evidenceNote && <span>Note: "{act.evidenceNote}"</span>}
                        {(act.externalUrl || act.evidenceUrl) && (
                          <a
                            href={act.externalUrl || act.evidenceUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                          >
                            <span>View Reference</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400">
                      {act.classificationReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
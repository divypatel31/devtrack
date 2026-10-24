import { prisma } from '../config/db';
import { env } from '../config/env';
import {
  createOAuthState,
  verifyOAuthState,
  encryptSecret,
  decryptSecret,
} from '../utils/crypto';
import { AppError } from './habit.service';
import {
  ingestVerifiedProviderActivity,
  recalculateAllUserGoals,
} from './performance.service';
import { formatDateStr } from '../utils/date';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_DEAUTH_URL = 'https://www.strava.com/oauth/deauthorize';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';

// In-flight token refresh lock per userId:provider to prevent concurrent refresh races
const refreshLocks = new Map<string, Promise<string>>();

export function isStravaConfigured(): boolean {
  return Boolean(
    env.STRAVA_CLIENT_ID.trim().length > 0 && env.STRAVA_CLIENT_SECRET.trim().length > 0
  );
}

export function isGitHubConfigured(): boolean {
  return Boolean(
    env.GITHUB_CLIENT_ID.trim().length > 0 && env.GITHUB_CLIENT_SECRET.trim().length > 0
  );
}

/**
 * Ensures an external provider account (e.g. Strava athlete ID or GitHub user ID)
 * is not already bound to another DevTrack user account.
 */
async function assertProviderAccountNotBoundToAnotherUser(
  userId: string,
  provider: 'STRAVA' | 'GITHUB',
  externalAccountId: string
): Promise<void> {
  const conflict = await prisma.providerConnection.findFirst({
    where: {
      provider,
      externalAccountId,
      status: 'CONNECTED',
      NOT: { userId },
    },
  });

  if (conflict) {
    throw new AppError(
      `This ${provider} account is already connected to another DevTrack user.`,
      409
    );
  }
}

/**
 * Lists provider connection statuses for the authenticated user without ever exposing tokens.
 */
export async function getUserProviderStatuses(userId: string) {
  const rows = await prisma.providerConnection.findMany({
    where: { userId },
    select: {
      provider: true,
      status: true,
      displayName: true,
      externalAccountId: true,
      scopes: true,
      lastSyncedAt: true,
      lastError: true,
      updatedAt: true,
    },
  });

  const stravaRow = rows.find((r) => r.provider === 'STRAVA');
  const githubRow = rows.find((r) => r.provider === 'GITHUB');

  return {
    strava: {
      provider: 'STRAVA',
      oauthConfiguredOnServer: isStravaConfigured(),
      status: stravaRow?.status || (isStravaConfigured() ? 'DISCONNECTED' : 'UNCONFIGURED'),
      displayName: stravaRow?.displayName || null,
      externalAccountId: stravaRow?.externalAccountId || null,
      scopes: stravaRow?.scopes || null,
      lastSyncedAt: stravaRow?.lastSyncedAt || null,
      lastError: stravaRow?.lastError || null,
    },
    github: {
      provider: 'GITHUB',
      oauthConfiguredOnServer: isGitHubConfigured(),
      status: githubRow?.status || (isGitHubConfigured() ? 'DISCONNECTED' : 'UNCONFIGURED'),
      displayName: githubRow?.displayName || null,
      externalAccountId: githubRow?.externalAccountId || null,
      scopes: githubRow?.scopes || null,
      lastSyncedAt: githubRow?.lastSyncedAt || null,
      lastError: githubRow?.lastError || null,
    },
  };
}

/**
 * Generates an official Strava OAuth 2.0 authorization URL with a one-time signed state token.
 */
export function buildStravaConnectUrl(userId: string): {
  configured: boolean;
  authorizationUrl: string | null;
  state: string;
  message?: string;
} {
  const state = createOAuthState(userId, 'STRAVA');
  if (!isStravaConfigured()) {
    return {
      configured: false,
      authorizationUrl: null,
      state,
      message:
        'Strava API credentials (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET) are not configured in backend/.env. Add your Strava API Application credentials to enable live OAuth connection.',
    };
  }

  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });

  return {
    configured: true,
    authorizationUrl: `${STRAVA_AUTH_URL}?${params.toString()}`,
    state,
  };
}

/**
 * Generates an official GitHub OAuth 2.0 authorization URL with a one-time signed state token.
 */
export function buildGitHubConnectUrl(userId: string): {
  configured: boolean;
  authorizationUrl: string | null;
  state: string;
  message?: string;
} {
  const state = createOAuthState(userId, 'GITHUB');
  if (!isGitHubConfigured()) {
    return {
      configured: false,
      authorizationUrl: null,
      state,
      message:
        'GitHub OAuth credentials (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) are not configured in backend/.env. Unauthenticated username syncing is disabled to prevent identity spoofing.',
    };
  }

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: 'read:user',
    state,
  });

  return {
    configured: true,
    authorizationUrl: `${GITHUB_AUTH_URL}?${params.toString()}`,
    state,
  };
}

/**
 * Exchanges a Strava OAuth authorization code for tokens on the server, verifies the one-time HMAC state,
 * checks cross-user athlete ownership, and stores AES-256-GCM encrypted tokens.
 */
export async function exchangeStravaOAuthCode(
  userId: string,
  code: string,
  stateToken: string
) {
  try {
    verifyOAuthState(stateToken, userId, 'STRAVA');
  } catch (err) {
    throw new AppError(
      err instanceof Error ? err.message : 'Invalid OAuth state parameter.',
      400
    );
  }

  if (!code || typeof code !== 'string') {
    throw new AppError('Authorization code is required.', 400);
  }

  if (code.startsWith('mock_strava_code_')) {
    if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new AppError('Mock OAuth codes are only permitted in test environments.', 403);
    }
    const athleteId = code.replace('mock_strava_code_', '') || '99001';
    await assertProviderAccountNotBoundToAnotherUser(userId, 'STRAVA', athleteId);

    const conn = await prisma.providerConnection.upsert({
      where: { userId_provider: { userId, provider: 'STRAVA' } },
      update: {
        externalAccountId: athleteId,
        displayName: `Strava Athlete #${athleteId}`,
        scopes: 'read,activity:read_all',
        encryptedAccessToken: encryptSecret(`mock_strava_access_${athleteId}`),
        encryptedRefreshToken: encryptSecret(`mock_strava_refresh_${athleteId}`),
        tokenExpiresAt: new Date(Date.now() + 6 * 3600 * 1000),
        status: 'CONNECTED',
        lastError: null,
      },
      create: {
        userId,
        provider: 'STRAVA',
        externalAccountId: athleteId,
        displayName: `Strava Athlete #${athleteId}`,
        scopes: 'read,activity:read_all',
        encryptedAccessToken: encryptSecret(`mock_strava_access_${athleteId}`),
        encryptedRefreshToken: encryptSecret(`mock_strava_refresh_${athleteId}`),
        tokenExpiresAt: new Date(Date.now() + 6 * 3600 * 1000),
        status: 'CONNECTED',
      },
    });
    return {
      provider: conn.provider,
      status: conn.status,
      displayName: conn.displayName,
      externalAccountId: conn.externalAccountId,
    };
  }

  if (!isStravaConfigured()) {
    throw new AppError('Strava OAuth is not configured on this server.', 400);
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new AppError(`Strava token exchange failed (HTTP ${response.status}).`, 400);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    athlete?: { id?: number; firstname?: string; lastname?: string; username?: string };
  };

  if (!data.access_token || !data.refresh_token || !data.athlete?.id) {
    throw new AppError('Strava token response was missing required athlete identity or tokens.', 400);
  }

  const athleteIdStr = String(data.athlete.id);
  await assertProviderAccountNotBoundToAnotherUser(userId, 'STRAVA', athleteIdStr);

  const athleteName =
    [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(' ') ||
    data.athlete.username ||
    `Strava Athlete #${athleteIdStr}`;

  const conn = await prisma.providerConnection.upsert({
    where: { userId_provider: { userId, provider: 'STRAVA' } },
    update: {
      externalAccountId: athleteIdStr,
      displayName: athleteName,
      scopes: 'read,activity:read_all',
      encryptedAccessToken: encryptSecret(data.access_token),
      encryptedRefreshToken: encryptSecret(data.refresh_token),
      tokenExpiresAt: new Date((data.expires_at || Math.floor(Date.now() / 1000) + 21600) * 1000),
      status: 'CONNECTED',
      lastError: null,
    },
    create: {
      userId,
      provider: 'STRAVA',
      externalAccountId: athleteIdStr,
      displayName: athleteName,
      scopes: 'read,activity:read_all',
      encryptedAccessToken: encryptSecret(data.access_token),
      encryptedRefreshToken: encryptSecret(data.refresh_token),
      tokenExpiresAt: new Date((data.expires_at || Math.floor(Date.now() / 1000) + 21600) * 1000),
      status: 'CONNECTED',
    },
  });

  return {
    provider: conn.provider,
    status: conn.status,
    displayName: conn.displayName,
    externalAccountId: conn.externalAccountId,
  };
}

/**
 * Exchanges a GitHub OAuth authorization code for an access token, verifies the authenticated
 * GitHub user's identity via GET https://api.github.com/user, checks cross-user binding,
 * and stores the encrypted token.
 */
export async function exchangeGitHubOAuthCode(
  userId: string,
  code: string,
  stateToken: string
) {
  try {
    verifyOAuthState(stateToken, userId, 'GITHUB');
  } catch (err) {
    throw new AppError(
      err instanceof Error ? err.message : 'Invalid OAuth state parameter.',
      400
    );
  }

  if (!code || typeof code !== 'string') {
    throw new AppError('Authorization code is required.', 400);
  }

  if (code.startsWith('mock_github_code_')) {
    if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new AppError('Mock OAuth codes are only permitted in test environments.', 403);
    }
    const ghLogin = code.replace('mock_github_code_', '') || 'divy-gh';
    const externalAccountId = `gh_id_${ghLogin}`;
    await assertProviderAccountNotBoundToAnotherUser(userId, 'GITHUB', externalAccountId);

    const conn = await prisma.providerConnection.upsert({
      where: { userId_provider: { userId, provider: 'GITHUB' } },
      update: {
        externalAccountId,
        displayName: `@${ghLogin}`,
        scopes: 'read:user',
        encryptedAccessToken: encryptSecret(`mock_github_access_${ghLogin}`),
        status: 'CONNECTED',
        lastError: null,
      },
      create: {
        userId,
        provider: 'GITHUB',
        externalAccountId,
        displayName: `@${ghLogin}`,
        scopes: 'read:user',
        encryptedAccessToken: encryptSecret(`mock_github_access_${ghLogin}`),
        status: 'CONNECTED',
      },
    });
    return {
      provider: conn.provider,
      status: conn.status,
      displayName: conn.displayName,
      externalAccountId: conn.externalAccountId,
    };
  }

  if (!isGitHubConfigured()) {
    throw new AppError('GitHub OAuth is not configured on this server.', 400);
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    throw new AppError(`GitHub token exchange failed (HTTP ${tokenRes.status}).`, 400);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
  };

  if (!tokenData.access_token || tokenData.error) {
    throw new AppError('GitHub OAuth code exchange failed or was denied.', 400);
  }

  // Verify the authenticated GitHub user's identity via official /user endpoint
  const userRes = await fetch(GITHUB_USER_API, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DevTrack-Performance-Platform',
    },
  });

  if (!userRes.ok) {
    throw new AppError('Failed to verify authenticated GitHub user identity.', 401);
  }

  const ghUser = (await userRes.json()) as { id?: number; login?: string };
  if (!ghUser.id || !ghUser.login) {
    throw new AppError('GitHub user profile did not return a valid id and login.', 400);
  }

  const externalAccountId = String(ghUser.id);
  await assertProviderAccountNotBoundToAnotherUser(userId, 'GITHUB', externalAccountId);

  const conn = await prisma.providerConnection.upsert({
    where: { userId_provider: { userId, provider: 'GITHUB' } },
    update: {
      externalAccountId,
      displayName: `@${ghUser.login}`,
      scopes: tokenData.scope || 'read:user',
      encryptedAccessToken: encryptSecret(tokenData.access_token),
      status: 'CONNECTED',
      lastError: null,
    },
    create: {
      userId,
      provider: 'GITHUB',
      externalAccountId,
      displayName: `@${ghUser.login}`,
      scopes: tokenData.scope || 'read:user',
      encryptedAccessToken: encryptSecret(tokenData.access_token),
      status: 'CONNECTED',
    },
  });

  return {
    provider: conn.provider,
    status: conn.status,
    displayName: conn.displayName,
    externalAccountId: conn.externalAccountId,
  };
}

/**
 * Refreshes an expired Strava access token using an in-flight lock per user to prevent concurrent refresh races.
 */
export async function ensureValidStravaAccessToken(userId: string): Promise<string> {
  const lockKey = `${userId}:STRAVA`;
  const existingLock = refreshLocks.get(lockKey);
  if (existingLock) {
    return existingLock;
  }

  const refreshPromise = (async () => {
    const conn = await prisma.providerConnection.findUnique({
      where: { userId_provider: { userId, provider: 'STRAVA' } },
    });

    if (!conn || conn.status !== 'CONNECTED' || !conn.encryptedAccessToken) {
      throw new AppError('Strava account is not connected.', 400);
    }

    const accessToken = decryptSecret(conn.encryptedAccessToken);
    const nowPlusBuffer = new Date(Date.now() + 60 * 1000);

    if (!conn.tokenExpiresAt || conn.tokenExpiresAt > nowPlusBuffer) {
      return accessToken;
    }

    if (!conn.encryptedRefreshToken) {
      throw new AppError('Strava refresh token is missing. Please reconnect Strava.', 401);
    }

    const refreshToken = decryptSecret(conn.encryptedRefreshToken);

    if (refreshToken.startsWith('mock_strava_refresh_')) {
      if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
        throw new AppError('Mock tokens are restricted to test environments.', 403);
      }
      const athleteId = refreshToken.replace('mock_strava_refresh_', '');
      const newAccess = `mock_strava_access_${athleteId}_refreshed`;
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: {
          encryptedAccessToken: encryptSecret(newAccess),
          tokenExpiresAt: new Date(Date.now() + 6 * 3600 * 1000),
        },
      });
      return newAccess;
    }

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: { status: 'ERROR', lastError: `Token refresh failed (${response.status})` },
      });
      throw new AppError('Strava session expired or revoked. Please reconnect Strava.', 401);
    }

    const refreshed = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };

    await prisma.providerConnection.update({
      where: { id: conn.id },
      data: {
        encryptedAccessToken: encryptSecret(refreshed.access_token),
        encryptedRefreshToken: encryptSecret(refreshed.refresh_token),
        tokenExpiresAt: new Date(refreshed.expires_at * 1000),
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return refreshed.access_token;
  })();

  refreshLocks.set(lockKey, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshLocks.delete(lockKey);
  }
}

function mapStravaSportToActivityType(sportType?: string): string {
  const upper = (sportType || '').toUpperCase();
  if (upper.includes('RUN')) return 'RUN';
  if (upper.includes('RIDE') || upper.includes('CYCLE')) return 'RIDE';
  if (upper.includes('SWIM')) return 'SWIM';
  return 'WORKOUT';
}

/**
 * Synchronizes recent Strava activities for the authenticated user with bounded pagination
 * and athlete ownership verification.
 */
export async function syncStravaActivities(userId: string, maxPages = 2) {
  const conn = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: 'STRAVA' } },
  });
  if (!conn || conn.status !== 'CONNECTED') {
    throw new AppError('Strava account is not connected.', 400);
  }

  const accessToken = await ensureValidStravaAccessToken(userId);
  const safeMaxPages = Math.min(Math.max(Number(maxPages) || 1, 1), 3);

  interface RawStravaActivity {
    id: number | string;
    athlete?: { id?: number | string };
    name: string;
    sport_type?: string;
    type?: string;
    start_date: string;
    start_date_local?: string;
    distance?: number;
    moving_time?: number;
    elapsed_time?: number;
    total_elevation_gain?: number;
    has_heartrate?: boolean;
    average_heartrate?: number;
    max_heartrate?: number;
  }

  const rawActivities: RawStravaActivity[] = [];

  if (accessToken.startsWith('mock_strava_access_')) {
    if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new AppError('Mock tokens are restricted to test environments.', 403);
    }
    const todayStr = formatDateStr(new Date());
    rawActivities.push(
      {
        id: `strava_act_${userId.slice(0, 6)}_1`,
        athlete: { id: conn.externalAccountId || '777' },
        name: 'Morning Tempo Run',
        sport_type: 'Run',
        start_date: new Date().toISOString(),
        start_date_local: `${todayStr}T06:30:00Z`,
        distance: 10000,
        moving_time: 2850,
        elapsed_time: 2910,
        total_elevation_gain: 84,
        has_heartrate: false,
      },
      {
        id: `strava_act_${userId.slice(0, 6)}_2`,
        athlete: { id: conn.externalAccountId || '777' },
        name: 'Endurance Zone 2 Ride',
        sport_type: 'Ride',
        start_date: new Date().toISOString(),
        start_date_local: `${todayStr}T17:00:00Z`,
        distance: 32500,
        moving_time: 4200,
        elapsed_time: 4350,
        total_elevation_gain: 310,
        has_heartrate: true,
        average_heartrate: 146,
        max_heartrate: 171,
      },
      {
        // Foreign athlete activity in payload - must be filtered out by ownership verification!
        id: `strava_act_foreign_999`,
        athlete: { id: 'foreign_athlete_999999' },
        name: 'Foreign Athlete Run (Should Be Ignored)',
        sport_type: 'Run',
        start_date: new Date().toISOString(),
        start_date_local: `${todayStr}T08:00:00Z`,
        distance: 50000,
        moving_time: 10000,
      }
    );
  } else {
    for (let page = 1; page <= safeMaxPages; page++) {
      const response = await fetch(`${STRAVA_ACTIVITIES_URL}?per_page=30&page=${page}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 429) {
        throw new AppError(
          'Strava API rate limit reached (HTTP 429). Please wait 15 minutes before syncing again.',
          429
        );
      }
      if (response.status === 401 || response.status === 403) {
        await prisma.providerConnection.updateMany({
          where: { userId, provider: 'STRAVA' },
          data: { status: 'REVOKED', lastError: 'Strava permissions revoked or expired.' },
        });
        throw new AppError('Strava permissions were revoked. Please reconnect Strava.', 401);
      }
      if (!response.ok) {
        throw new AppError(`Strava API error (HTTP ${response.status}).`, 502);
      }

      const pageItems = (await response.json()) as RawStravaActivity[];
      if (!Array.isArray(pageItems) || pageItems.length === 0) {
        break;
      }
      rawActivities.push(...pageItems);
      if (pageItems.length < 30) {
        break;
      }
    }
  }

  const syncedRecords = [];
  for (const act of rawActivities) {
    if (!act || !act.id || !act.name) continue;

    // Verify activity athlete ID matches the connected Strava athlete ID
    if (
      act.athlete?.id !== undefined &&
      conn.externalAccountId &&
      String(act.athlete.id) !== String(conn.externalAccountId)
    ) {
      continue;
    }

    const localDate =
      (act.start_date_local || act.start_date || '').slice(0, 10) || formatDateStr(new Date());
    const activityType = mapStravaSportToActivityType(act.sport_type || act.type);

    const record = await ingestVerifiedProviderActivity({
      userId,
      provider: 'STRAVA',
      externalId: String(act.id),
      externalUrl: `https://www.strava.com/activities/${act.id}`,
      domain: 'ATHLETE',
      activityType,
      title: act.name,
      occurredAt: act.start_date ? new Date(act.start_date) : new Date(),
      localDate,
      distanceMeters:
        typeof act.distance === 'number' && act.distance >= 0 ? act.distance : undefined,
      movingTimeSeconds:
        typeof act.moving_time === 'number' && act.moving_time >= 0 ? act.moving_time : undefined,
      elapsedTimeSeconds:
        typeof act.elapsed_time === 'number' && act.elapsed_time >= 0
          ? act.elapsed_time
          : undefined,
      durationMinutes:
        typeof act.moving_time === 'number' && act.moving_time >= 0
          ? Math.round(act.moving_time / 60)
          : undefined,
      elevationGainMeters:
        typeof act.total_elevation_gain === 'number' && act.total_elevation_gain >= 0
          ? act.total_elevation_gain
          : undefined,
      avgHeartRate:
        act.has_heartrate && typeof act.average_heartrate === 'number' && act.average_heartrate > 0
          ? act.average_heartrate
          : undefined,
      maxHeartRate:
        act.has_heartrate && typeof act.max_heartrate === 'number' && act.max_heartrate > 0
          ? act.max_heartrate
          : undefined,
      unit: 'km',
      evidenceNote: `Verified Strava ${act.sport_type || act.type || 'Activity'}`,
    });
    syncedRecords.push(record);
  }

  await prisma.providerConnection.updateMany({
    where: { userId, provider: 'STRAVA' },
    data: { lastSyncedAt: new Date(), lastError: null },
  });

  return {
    provider: 'STRAVA',
    syncedCount: syncedRecords.length,
    activities: syncedRecords,
  };
}

/**
 * Synchronizes GitHub push/PR events ONLY for an OAuth-verified GitHub account bound to userId.
 * Rejects any attempt to sync an arbitrary unauthenticated username.
 */
export async function syncGitHubActivities(userId: string) {
  const conn = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: 'GITHUB' } },
  });

  if (!conn || conn.status !== 'CONNECTED' || !conn.encryptedAccessToken || !conn.displayName) {
    throw new AppError(
      'GitHub account must be connected via OAuth 2.0 before syncing verified events. Unauthenticated username claims are blocked.',
      400
    );
  }

  const accessToken = decryptSecret(conn.encryptedAccessToken);
  const verifiedLogin = conn.displayName.replace(/^@/, '');
  const todayStr = formatDateStr(new Date());

  interface RawGitHubEvent {
    id: string;
    type: string;
    actor?: { id?: number | string; login?: string };
    created_at: string;
    repo?: { name?: string };
    payload?: { commits?: Array<{ message?: string }> };
  }

  let events: RawGitHubEvent[] = [];

  if (accessToken.startsWith('mock_github_access_')) {
    if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new AppError('Mock tokens are restricted to test environments.', 403);
    }
    events = [
      {
        id: `gh_evt_${userId.slice(0, 6)}_1`,
        type: 'PushEvent',
        actor: { id: conn.externalAccountId || `gh_id_${verifiedLogin}`, login: verifiedLogin },
        created_at: new Date().toISOString(),
        repo: { name: `${verifiedLogin}/devtrack` },
        payload: { commits: [{ message: 'feat: verified OAuth GitHub event' }] },
      },
      {
        // Foreign actor event in stream - must be ignored!
        id: `gh_evt_foreign_actor_999`,
        type: 'PushEvent',
        actor: { id: 'other_user_id', login: 'torvalds' },
        created_at: new Date().toISOString(),
        repo: { name: 'torvalds/linux' },
        payload: { commits: [{ message: 'Linux kernel release' }] },
      },
    ];
  } else {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(verifiedLogin)}/events?per_page=30`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DevTrack-Performance-Platform',
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: { status: 'REVOKED', lastError: 'GitHub OAuth token expired or revoked.' },
      });
      throw new AppError('GitHub OAuth session expired or revoked. Please reconnect GitHub.', 401);
    }
    if (response.status === 429) {
      throw new AppError('GitHub API rate limit reached. Try again later.', 429);
    }
    if (!response.ok) {
      throw new AppError(`GitHub API returned HTTP ${response.status}.`, 502);
    }

    events = (await response.json()) as RawGitHubEvent[];
  }

  const syncedRecords = [];
  for (const ev of events) {
    if (!ev || !ev.id) continue;
    if (ev.type !== 'PushEvent' && ev.type !== 'PullRequestEvent') continue;

    // Verify event actor matches the authenticated user's connected GitHub identity
    if (
      ev.actor?.login &&
      ev.actor.login.toLowerCase() !== verifiedLogin.toLowerCase()
    ) {
      continue;
    }
    if (
      ev.actor?.id &&
      conn.externalAccountId &&
      String(ev.actor.id) !== String(conn.externalAccountId)
    ) {
      continue;
    }

    const repoName = ev.repo?.name || verifiedLogin;
    const commitCount = ev.payload?.commits?.length || 1;
    const localDate = (ev.created_at || '').slice(0, 10) || todayStr;

    const record = await ingestVerifiedProviderActivity({
      userId,
      provider: 'GITHUB',
      externalId: String(ev.id),
      externalUrl: `https://github.com/${repoName}`,
      domain: 'DEVELOPER',
      activityType: 'GITHUB_PUSH',
      title: `${ev.type === 'PushEvent' ? 'GitHub Push' : 'Pull Request'} to ${repoName}`,
      occurredAt: ev.created_at ? new Date(ev.created_at) : new Date(),
      localDate,
      quantity: commitCount,
      unit: 'commits',
      evidenceNote: `OAuth-verified GitHub ${ev.type} by @${verifiedLogin} on ${repoName} (Note: event count reflects repository activity, not code quality).`,
    });
    syncedRecords.push(record);
  }

  await prisma.providerConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date(), lastError: null },
  });

  return {
    provider: 'GITHUB',
    username: verifiedLogin,
    syncedCount: syncedRecords.length,
    activities: syncedRecords,
  };
}

/**
 * Safely disconnects a provider integration, wiping stored encrypted tokens inside a transaction,
 * marks imported activities as REVOKED (or deletes them), and recalculates all user goals.
 */
export async function disconnectProvider(
  userId: string,
  provider: 'STRAVA' | 'GITHUB',
  deleteImportedActivities = false
) {
  const existing = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (!existing) {
    throw new AppError(`No ${provider} connection found for this account.`, 404);
  }

  if (
    provider === 'STRAVA' &&
    existing.encryptedAccessToken &&
    isStravaConfigured() &&
    process.env.NODE_ENV !== 'test'
  ) {
    try {
      const token = decryptSecret(existing.encryptedAccessToken);
      await fetch(STRAVA_DEAUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: token }).toString(),
      });
    } catch {
      // Ignore upstream network error during local disconnect cleanup
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.providerConnection.update({
      where: { id: existing.id },
      data: {
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        status: 'DISCONNECTED',
        lastError: null,
      },
    });

    if (deleteImportedActivities) {
      await tx.activityRecord.deleteMany({
        where: { userId, provider },
      });
    } else {
      await tx.activityRecord.updateMany({
        where: { userId, provider },
        data: { syncStatus: 'REVOKED' },
      });
    }
  });

  // Immediately recalculate all user goals so revoked/deleted activities no longer inflate progress
  await recalculateAllUserGoals(userId);

  return {
    provider,
    status: 'DISCONNECTED',
    deletedActivities: deleteImportedActivities,
  };
}
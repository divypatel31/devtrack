import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { formatDateStr } from '../utils/date';
import { createOAuthState, encryptSecret, decryptSecret } from '../utils/crypto';
import { ensureValidStravaAccessToken } from '../services/provider.service';

describe('DevTrack 2.0 Security Audit: Trust Integrity, OAuth Replay/Binding & Goal Recalculation (/api/performance)', () => {
  let tokenA = '';
  let tokenB = '';
  let userIdA = '';
  let userIdB = '';
  let athleteGoalIdA = '';
  const todayStr = formatDateStr(new Date());

  beforeAll(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await prisma.$disconnect().catch(() => {});
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    const tag = Date.now();
    const regA = await request(app).post('/api/auth/register').send({
      email: `sec_a_${tag}@devtrack.local`,
      name: 'Security User A',
      password: 'Password123!',
    });
    tokenA = regA.body.token;
    userIdA = regA.body.user.id;

    const regB = await request(app).post('/api/auth/register').send({
      email: `sec_b_${tag}@devtrack.local`,
      name: 'Security User B',
      password: 'Password123!',
    });
    tokenB = regB.body.token;
    userIdB = regB.body.user.id;
  }, 60000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'sec_a_' } },
          { email: { startsWith: 'sec_b_' } },
        ],
      },
    });
    await prisma.$disconnect();
  }, 60000);

  it('1. blocks client PROVIDER_VERIFIED spoofing, validates AES-256-GCM tamper detection, and recalculates goals on delete', async () => {
    // Verify AES-256-GCM tamper detection fails closed
    const cipher = encryptSecret('test_secret_payload');
    expect(decryptSecret(cipher)).toBe('test_secret_payload');
    const tampered = cipher.slice(0, -2) + (cipher.endsWith('aa') ? 'bb' : 'aa');
    expect(() => decryptSecret(tampered)).toThrow();

    // Create a Learning READING goal (50 pages)
    const readGoalRes = await request(app)
      .post('/api/performance/goals')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        domain: 'LEARNING',
        title: 'Read 50 Pages of DDIA',
        metricType: 'PAGES',
        targetValue: 50,
        unit: 'pages',
        startDate: todayStr,
      });
    expect(readGoalRes.status).toBe(201);
    const readGoalId = readGoalRes.body.goal.id;

    // Client attempts to spoof PROVIDER_VERIFIED & userIdB
    const spoofRes = await request(app)
      .post('/api/performance/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        userId: userIdB,
        domain: 'ATHLETE',
        activityType: 'RUN',
        title: 'Client Run With Link',
        localDate: todayStr,
        evidenceClass: 'PROVIDER_VERIFIED',
        provider: 'STRAVA',
        externalId: 'spoof_999',
        evidenceUrl: 'https://www.strava.com/activities/123456',
        distanceMeters: 5000,
        movingTimeSeconds: 1500,
      });
    expect(spoofRes.status).toBe(201);
    expect(spoofRes.body.activity.userId).toBe(userIdA);
    expect(spoofRes.body.activity.evidenceClass).toBe('EVIDENCE_SUBMITTED');
    expect(spoofRes.body.activity.provider).toBe('NONE');

    // Log a 30-page READING activity -> updates readGoalId to 30 pages
    const readAct = await request(app)
      .post('/api/performance/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        goalId: readGoalId,
        domain: 'LEARNING',
        activityType: 'READING',
        title: 'DDIA Chapter 3',
        localDate: todayStr,
        durationMinutes: 45,
        quantity: 30,
        unit: 'pages',
      });
    expect(readAct.status).toBe(201);
    expect(readAct.body.activity.evidenceClass).toBe('SELF_REPORTED');

    let goalsList = await request(app)
      .get('/api/performance/goals?domain=LEARNING')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(goalsList.body.goals[0].currentValue).toBe(30);

    // Delete the 30-page reading activity -> goal progress must recalculate back to 0!
    const delAct = await request(app)
      .delete(`/api/performance/activities/${readAct.body.activity.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(delAct.status).toBe(200);

    goalsList = await request(app)
      .get('/api/performance/goals?domain=LEARNING')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(goalsList.body.goals[0].currentValue).toBe(0);
  });

  it('2. enforces Strava OAuth state one-time replay protection, cross-user account collision lock, token refresh concurrency, and foreign athlete filtering', async () => {
    // 1. Cross-user state mismatch -> 400
    const stateForUserB = createOAuthState(userIdB, 'STRAVA');
    const crossStateRes = await request(app)
      .post('/api/performance/providers/strava/callback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'mock_strava_code_777', state: stateForUserB });
    expect(crossStateRes.status).toBe(400);

    // 2. Valid OAuth state for User A -> connects Strava athlete #777
    const validStateA = createOAuthState(userIdA, 'STRAVA');
    const connectRes = await request(app)
      .post('/api/performance/providers/strava/callback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'mock_strava_code_777', state: validStateA });
    expect(connectRes.status).toBe(200);
    expect(connectRes.body.connection.status).toBe('CONNECTED');

    // 3. Replaying the exact same validStateA a second time -> blocked (400)!
    const replayRes = await request(app)
      .post('/api/performance/providers/strava/callback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'mock_strava_code_777', state: validStateA });
    expect(replayRes.status).toBe(400);

    // 4. User B attempts to bind the same Strava athlete #777 -> blocked with 409 Conflict!
    const validStateB = createOAuthState(userIdB, 'STRAVA');
    const collisionRes = await request(app)
      .post('/api/performance/providers/strava/callback')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: 'mock_strava_code_777', state: validStateB });
    expect(collisionRes.status).toBe(409);

    // 5. Simulate expired Strava token and test concurrent token refresh lock
    await prisma.providerConnection.update({
      where: { userId_provider: { userId: userIdA, provider: 'STRAVA' } },
      data: { tokenExpiresAt: new Date(Date.now() - 60 * 1000) },
    });
    const [refreshed1, refreshed2] = await Promise.all([
      ensureValidStravaAccessToken(userIdA),
      ensureValidStravaAccessToken(userIdA),
    ]);
    expect(refreshed1).toBe(refreshed2);
    expect(refreshed1).toContain('_refreshed');

    // 6. Create Athlete Goal (40 km) and sync Strava
    const goalRes = await request(app)
      .post('/api/performance/goals')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        domain: 'ATHLETE',
        title: 'Weekly Distance 40 km',
        metricType: 'DISTANCE_KM',
        targetValue: 40,
        unit: 'km',
        startDate: todayStr,
      });
    athleteGoalIdA = goalRes.body.goal.id;

    // Sync Strava -> imports 2 owned activities (10km + 32.5km) and ignores the 3rd foreign athlete activity!
    const sync1 = await request(app)
      .post('/api/performance/providers/strava/sync')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(sync1.status).toBe(200);
    expect(sync1.body.syncedCount).toBe(2);

    // Duplicate Strava sync -> idempotent, does not double-count goal progress!
    const sync2 = await request(app)
      .post('/api/performance/providers/strava/sync')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(sync2.status).toBe(200);

    const goalsAfterSync = await request(app)
      .get('/api/performance/goals?domain=ATHLETE')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(goalsAfterSync.body.goals[0].currentValue).toBe(42.5);
    expect(goalsAfterSync.body.goals[0].status).toBe('COMPLETED');
  });

  it('3. blocks unauthenticated GitHub username spoofing, verifies OAuth GitHub actor ownership, and excludes REVOKED records on disconnect', async () => {
    // 1. Attempting to sync an arbitrary GitHub username without OAuth -> 400 Bad Request
    const spoofGhRes = await request(app)
      .post('/api/performance/providers/github/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ username: 'torvalds' });
    expect(spoofGhRes.status).toBe(400);

    // 2. Attempting to sync GitHub before connecting OAuth -> 400 Bad Request
    const unconnGhRes = await request(app)
      .post('/api/performance/providers/github/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(unconnGhRes.status).toBe(400);

    // 3. Connect GitHub via OAuth callback with verified state for User A
    const ghStateA = createOAuthState(userIdA, 'GITHUB');
    const ghConnect = await request(app)
      .post('/api/performance/providers/github/callback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'mock_github_code_divypatel', state: ghStateA });
    expect(ghConnect.status).toBe(200);
    expect(ghConnect.body.connection.displayName).toBe('@divypatel');

    // 4. Sync OAuth-verified GitHub events -> imports User A's event (1) and ignores foreign 'torvalds' event!
    const ghSync = await request(app)
      .post('/api/performance/providers/github/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(ghSync.status).toBe(200);
    expect(ghSync.body.syncedCount).toBe(1);

    // 5. Verify summary before disconnect: 3 providerVerifiedCount (2 Strava + 1 GitHub)
    const sumBefore = await request(app)
      .get(`/api/performance/summary?date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(
      sumBefore.body.summary.transparentScoring.evidenceBreakdown.providerVerifiedCount
    ).toBe(3);
    expect(sumBefore.body.summary.activityHeatmap).toHaveLength(84);
    expect(
      sumBefore.body.summary.weeklyReview.athleticRecovery7d.trainingDays
    ).toBeGreaterThanOrEqual(1);
    expect(
      sumBefore.body.summary.weeklyReview.goalRecommendations.length
    ).toBeGreaterThanOrEqual(1);

    // 6. Disconnect Strava (deleteActivities: false -> marks Strava records REVOKED)
    const discRes = await request(app)
      .post('/api/performance/providers/STRAVA/disconnect')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ deleteActivities: false });
    expect(discRes.status).toBe(200);

    // 7. Verify summary after Strava disconnect:
    // - Revoked Strava records must NO LONGER count in providerVerifiedCount (drops from 3 to 1)!
    // - Athlete Goal progress must recalculate from 42.5 km down to 0 km (ACTIVE) because Strava records are REVOKED!
    const sumAfter = await request(app)
      .get(`/api/performance/summary?date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(
      sumAfter.body.summary.transparentScoring.evidenceBreakdown.providerVerifiedCount
    ).toBe(1);
    expect(
      sumAfter.body.summary.transparentScoring.evidenceBreakdown.revokedCount
    ).toBe(2);

    const goalsAfterDisconnect = await request(app)
      .get('/api/performance/goals?domain=ATHLETE')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(goalsAfterDisconnect.body.goals[0].currentValue).toBe(0);
    expect(goalsAfterDisconnect.body.goals[0].status).toBe('ACTIVE');
  });
});
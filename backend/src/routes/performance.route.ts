import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import {
  getSummary,
  getActivities,
  postActivity,
  removeActivity,
  getGoals,
  postGoal,
  removeGoal,
  initiateStravaOAuth,
  completeStravaOAuth,
  triggerStravaSync,
  initiateGitHubOAuth,
  completeGitHubOAuth,
  triggerGitHubSync,
  disconnectProviderAccount,
} from '../controllers/performance.controller';

const router = Router();
const providerLimiter = createRateLimiter(20, 60 * 1000);

router.use(requireAuth);

router.get('/summary', getSummary);
router.get('/activities', getActivities);
router.post('/activities', postActivity);
router.delete('/activities/:id', removeActivity);

router.get('/goals', getGoals);
router.post('/goals', postGoal);
router.delete('/goals/:id', removeGoal);

router.get('/providers/strava/connect', providerLimiter, initiateStravaOAuth);
router.post('/providers/strava/callback', providerLimiter, completeStravaOAuth);
router.post('/providers/strava/sync', providerLimiter, triggerStravaSync);

router.get('/providers/github/connect', providerLimiter, initiateGitHubOAuth);
router.post('/providers/github/callback', providerLimiter, completeGitHubOAuth);
router.post('/providers/github/sync', providerLimiter, triggerGitHubSync);

router.post('/providers/:provider/disconnect', providerLimiter, disconnectProviderAccount);

export default router;
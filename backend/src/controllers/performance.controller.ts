import { Request, Response } from 'express';
import { AppError, isValidCalendarDate, parseTimezoneOffsetMinutes } from '../services/habit.service';
import * as performanceService from '../services/performance.service';
import * as providerService from '../services/provider.service';

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const dateQuery = req.query.date !== undefined ? String(req.query.date) : undefined;
    if (dateQuery !== undefined && !isValidCalendarDate(dateQuery)) {
      res.status(400).json({ error: 'Invalid date format. Expected valid YYYY-MM-DD.' });
      return;
    }

    let tzOffset: number | undefined;
    if (req.query.tzOffset !== undefined) {
      try {
        tzOffset = parseTimezoneOffsetMinutes(req.query.tzOffset);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid tzOffset.' });
        return;
      }
    }

    const summary = await performanceService.getUnifiedPerformanceSummary(
      req.user.id,
      dateQuery,
      tzOffset
    );
    const providers = await providerService.getUserProviderStatuses(req.user.id);

    res.status(200).json({ summary, providers });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[PerformanceController] getSummary error:', error);
    res.status(500).json({ error: 'Failed to load performance summary' });
  }
}

export async function getActivities(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const domain = req.query.domain ? String(req.query.domain) : undefined;
    const evidenceClass = req.query.evidenceClass ? String(req.query.evidenceClass) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const activities = await performanceService.listUserActivities(
      req.user.id,
      domain,
      evidenceClass,
      limit
    );
    res.status(200).json({ activities });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
}

export async function postActivity(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const activity = await performanceService.createClientActivity({
      ...req.body,
      userId: req.user.id,
    });
    res.status(201).json({ activity });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to log activity' });
  }
}

export async function removeActivity(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = await performanceService.deleteUserActivity(req.user.id, String(req.params.id));
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete activity' });
  }
}

export async function getGoals(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const domain = req.query.domain ? String(req.query.domain) : undefined;
    const goals = await performanceService.listPerformanceGoals(req.user.id, domain);
    res.status(200).json({ goals });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
}

export async function postGoal(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const goal = await performanceService.createPerformanceGoal({
      ...req.body,
      userId: req.user.id,
    });
    res.status(201).json({ goal });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create goal' });
  }
}

export async function removeGoal(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = await performanceService.deletePerformanceGoal(
      req.user.id,
      String(req.params.id)
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete goal' });
  }
}

export async function initiateStravaOAuth(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const payload = providerService.buildStravaConnectUrl(req.user.id);
    res.status(200).json(payload);
  } catch {
    res.status(500).json({ error: 'Failed to build Strava authorization URL' });
  }
}

export async function completeStravaOAuth(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const { code, state } = req.body ?? {};
    const connection = await providerService.exchangeStravaOAuthCode(
      req.user.id,
      String(code || ''),
      String(state || '')
    );
    res.status(200).json({ connection });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to exchange Strava authorization code' });
  }
}

export async function triggerStravaSync(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = await providerService.syncStravaActivities(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to synchronize Strava activities' });
  }
}

export async function initiateGitHubOAuth(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const payload = providerService.buildGitHubConnectUrl(req.user.id);
    res.status(200).json(payload);
  } catch {
    res.status(500).json({ error: 'Failed to build GitHub authorization URL' });
  }
}

export async function completeGitHubOAuth(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const { code, state } = req.body ?? {};
    const connection = await providerService.exchangeGitHubOAuthCode(
      req.user.id,
      String(code || ''),
      String(state || '')
    );
    res.status(200).json({ connection });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to exchange GitHub authorization code' });
  }
}

export async function triggerGitHubSync(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    // Rejects unauthenticated arbitrary username claims; uses verified OAuth connection only
    if (req.body?.username) {
      res.status(400).json({
        error:
          'Security policy: Arbitrary GitHub username claims are not permitted. Connect your GitHub account via OAuth 2.0 first.',
      });
      return;
    }
    const result = await providerService.syncGitHubActivities(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to synchronize GitHub activity' });
  }
}

export async function disconnectProviderAccount(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const providerParam = String(req.params.provider || '').toUpperCase();
    if (providerParam !== 'STRAVA' && providerParam !== 'GITHUB') {
      res.status(400).json({ error: 'Unsupported provider. Must be STRAVA or GITHUB.' });
      return;
    }
    const deleteActivities = req.body?.deleteActivities === true;
    const result = await providerService.disconnectProvider(
      req.user.id,
      providerParam,
      deleteActivities
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to disconnect provider' });
  }
}
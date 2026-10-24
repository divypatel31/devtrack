import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      next();
      return;
    }
    const key = `${req.ip || 'local'}:${req.baseUrl}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
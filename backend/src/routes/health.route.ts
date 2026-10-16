import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      service: 'devtrack-backend',
      database: 'connected',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'devtrack-backend',
      database: 'disconnected',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
import { Router, Request, Response } from 'express';
import { env } from '../config/env';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'devtrack-backend',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;

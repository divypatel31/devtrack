import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { createRateLimiter } from './middleware/rateLimit.middleware';
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import habitRouter from './routes/habit.route';
import performanceRouter from './routes/performance.route';

const app = express();
const authLimiter = createRateLimiter(30, 60 * 1000);

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/habits', habitRouter);
app.use('/api/performance', performanceRouter);

export default app;
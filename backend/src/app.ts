import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import habitRouter from './routes/habit.route';

const app = express();

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/habits', habitRouter);

export default app;
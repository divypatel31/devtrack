import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health.route';

const app = express();

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);

export default app;

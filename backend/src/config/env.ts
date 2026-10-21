import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const rawJwtSecret = process.env.JWT_SECRET;

if (nodeEnv === 'production' && (!rawJwtSecret || rawJwtSecret.trim().length < 32)) {
  throw new Error('FATAL: JWT_SECRET must be set to at least 32 characters in production.');
}

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: nodeEnv,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET: rawJwtSecret || 'devtrack-local-dev-secret-key-do-not-use-in-prod-2026',
};
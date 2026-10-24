import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const rawJwtSecret = process.env.JWT_SECRET;
const rawEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY || rawJwtSecret;

if (nodeEnv === 'production') {
  if (!rawJwtSecret || rawJwtSecret.trim().length < 32) {
    throw new Error('FATAL: JWT_SECRET must be set to at least 32 characters in production.');
  }
  if (!rawEncryptionKey || rawEncryptionKey.trim().length < 32) {
    throw new Error(
      'FATAL: TOKEN_ENCRYPTION_KEY (or JWT_SECRET) must be at least 32 characters in production.'
    );
  }
}

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: nodeEnv,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET: rawJwtSecret || 'devtrack-local-dev-secret-key-do-not-use-in-prod-2026',
  TOKEN_ENCRYPTION_KEY:
    rawEncryptionKey || 'devtrack-local-dev-token-encryption-key-2026-secure',
  STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID || '',
  STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET || '',
  STRAVA_REDIRECT_URI:
    process.env.STRAVA_REDIRECT_URI || 'http://localhost:5173/?strava_oauth=callback',
  STRAVA_WEBHOOK_VERIFY_TOKEN: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || '',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  GITHUB_REDIRECT_URI:
    process.env.GITHUB_REDIRECT_URI || 'http://localhost:5173/?github_oauth=callback',
};
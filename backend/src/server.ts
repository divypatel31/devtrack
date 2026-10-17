import app from './app';
import { env } from './config/env';
import { prisma } from './config/db';

const PORT = env.PORT;

async function connectWithRetry(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('[DevTrack DB] Connected to Neon PostgreSQL successfully.');
      return;
    } catch {
      console.warn(
        `[DevTrack DB] Waiting for Neon Serverless cold start (attempt ${attempt}/${retries})...`
      );
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
}

app.listen(PORT, () => {
  console.log(`[DevTrack Backend] Server running on http://localhost:${PORT}`);
  void connectWithRetry();
});
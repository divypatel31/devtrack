import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient({
  log: ['error', 'warn'],
});

function isTransientConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message || '');
  return (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'P1017' ||
    code === 'P2024' ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Can\'t reach database server') ||
    msg.includes('10054') ||
    msg.includes('Timed out fetching a new connection')
  );
}

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt === 3 || !isTransientConnectionError(err)) {
              throw err;
            }
            await basePrisma.$disconnect().catch(() => {});
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            await basePrisma.$connect().catch(() => {});
          }
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;
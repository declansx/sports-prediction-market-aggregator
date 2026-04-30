/**
 * One-off: clear the CanonicalBet table to force re-link on the next sync cycle.
 * Use when the canonicalize() key shape has changed and existing rows need rebuilding.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json --transpile-only scripts/clearCanonicalBets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const r = await prisma.canonicalBet.deleteMany({});
  console.log(`Deleted ${r.count} CanonicalBet rows. Outcome.canonicalBetId cleared via ON DELETE SET NULL.`);
  await prisma.$disconnect();
})();

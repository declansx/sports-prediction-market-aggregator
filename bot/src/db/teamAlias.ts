import { prisma } from './index';
import { canonicalTeamName } from '../adapters/teamNames';
import { createLogger } from '../logger';

const log = createLogger('teamAlias');

export async function lookupCanonical(
  platform: string,
  alias: string,
  league: string,
): Promise<string | null> {
  try {
    const row = await prisma.teamAlias.findUnique({
      where: { platform_alias_league: { platform, alias, league } },
    });
    return row?.canonical ?? null;
  } catch {
    return null;
  }
}

export async function recordAlias(
  canonical: string,
  platform: string,
  alias: string,
  league: string,
): Promise<void> {
  try {
    await prisma.teamAlias.upsert({
      where: { platform_alias_league: { platform, alias, league } },
      create: { canonical, platform, alias, league },
      update: { canonical },
    });
  } catch {
    // non-fatal — alias recording is best-effort
  }
}

export async function resolveTeamName(
  rawName: string,
  platform: string,
  league: string,
): Promise<string> {
  const fromDb = await lookupCanonical(platform, rawName, league);
  if (fromDb) return fromDb;

  const canonical = canonicalTeamName(rawName);

  // Record the alias for future exact lookups (fire-and-forget)
  recordAlias(canonical, platform, rawName, league).catch((err) => {
    log.error({ err, platform, rawName }, 'recordAlias failed');
  });

  return canonical;
}

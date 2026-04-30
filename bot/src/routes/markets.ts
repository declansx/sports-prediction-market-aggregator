import { Router, Request, Response } from 'express';
import { getOverlaidMarkets } from '../services/marketGroups';
import { createLogger } from '../logger';

const log = createLogger('markets');
const router = Router();

router.get('/api/markets', async (_req: Request, res: Response) => {
  try {
    const markets = await getOverlaidMarkets();

    const payload = markets.map((m) => ({
      id: m.id,
      eventId: m.eventId,
      platform: m.platform,
      externalId: m.externalId,
      sport: m.sport,
      league: m.league,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      name: m.name,
      startTime: m.startTime,
      status: m.status,
      betType: m.betType,
      line: m.line,
      mainLine: m.mainLine,
      sxEventId: m.sxEventId,
      fixtureState: m.fixtureState ?? null,
      outcomes: m.outcomes.map((o) => ({
        id: o.id,
        label: o.label,
        platform: m.platform,
        externalId: o.externalId ?? undefined,
        impliedOdds: o.impliedOdds,
        availableSize: o.availableSize,
        lastUpdated: o.lastUpdated,
        canonicalKey: o.canonicalKey,
      })),
    }));

    res.json(payload);
  } catch (err) {
    log.error({ err }, 'failed to fetch markets');
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;

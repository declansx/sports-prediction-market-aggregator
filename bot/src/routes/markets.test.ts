import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.mock is hoisted — use vi.hoisted() so the mock factory can reference these fns
const { mockFindMany, mockQueryRaw } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockQueryRaw: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db', () => ({
  prisma: {
    market: { findMany: mockFindMany },
    $queryRaw: mockQueryRaw,
  },
}));

import app from '../app';

const MOCK_MARKET = {
  id: 'market-1',
  eventId: 'event-1',
  platform: 'sx',
  externalId: '0xabc',
  startTime: new Date('2026-04-15T18:00:00Z'),
  betType: '1x2',
  line: null,
  mainLine: true,
  status: 'active',
  event: {
    id: 'event-1',
    sport: 'Basketball',
    league: 'NBA',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    startTime: new Date('2026-04-15T18:00:00Z'),
  },
  outcomes: [
    {
      id: 'out-1',
      label: 'Lakers',
      currentOdds: 0.52,
      liquidityDepth: 5000,
      lastUpdated: new Date('2026-04-13T21:00:00Z'),
      canonicalBet: { key: '1x2:home' },
    },
    {
      id: 'out-2',
      label: 'Warriors',
      currentOdds: 0.48,
      liquidityDepth: 4800,
      lastUpdated: new Date('2026-04-13T21:00:00Z'),
      canonicalBet: { key: '1x2:away' },
    },
  ],
};

describe('GET /api/markets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns 200 with a list of markets including outcomes', async () => {
    mockFindMany.mockResolvedValue([MOCK_MARKET]);

    const res = await request(app).get('/api/markets');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const m = res.body[0];
    expect(m.id).toBe('market-1');
    expect(m.eventId).toBe('event-1');
    expect(m.platform).toBe('sx');
    expect(m.sport).toBe('Basketball');
    expect(m.homeTeam).toBe('Lakers');
    expect(m.awayTeam).toBe('Warriors');
    expect(m.name).toBe('Lakers vs Warriors');
    expect(m.outcomes).toHaveLength(2);

    const o = m.outcomes[0];
    expect(o.label).toBe('Lakers');
    expect(o.impliedOdds).toBe(0.52);
    expect(o.availableSize).toBe(5000);
    expect(o.canonicalKey).toBe('1x2:home');
    expect(m.outcomes[1].canonicalKey).toBe('1x2:away');
  });

  it('returns 200 with empty array when no markets exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await request(app).get('/api/markets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when DB query fails', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/markets');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'internal_server_error' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

import app from '../app';
import { prisma } from '../db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qrMock = prisma.$queryRaw as any;

describe('GET /api/health', () => {
  beforeEach(() => {
    qrMock.mockReset();
    qrMock.mockResolvedValue([]);
  });

  it('returns 200 with status ok when db is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('returns 500 when db is unreachable', async () => {
    qrMock.mockRejectedValueOnce(new Error('SQLITE_CANTOPEN'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ status: 'error', db: 'unreachable' });
  });
});

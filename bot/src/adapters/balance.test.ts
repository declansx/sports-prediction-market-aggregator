import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: {
    POLYGON_RPC_URL: 'https://polygon.test',
    SX_NETWORK_RPC_URL: 'https://sx.test',
    POLYMARKET_FUNDER_ADDRESS: '0x1111111111111111111111111111111111111111',
    SX_PRIVATE_KEY: '0x' + '11'.repeat(32),
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
}));

const balanceOfMock = vi.fn();
const contractMock = vi.fn().mockImplementation(() => ({ balanceOf: balanceOfMock }));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
    Contract: contractMock,
  };
});

beforeEach(() => {
  balanceOfMock.mockReset();
  contractMock.mockClear();
});

const POLYMARKET_PUSD = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB';
const SX_USDC = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

describe('fetchBalances', () => {
  it('divides raw 6-decimal USDC values and returns both platforms', async () => {
    balanceOfMock.mockResolvedValueOnce(12_340_000n).mockResolvedValueOnce(56_780_000n);

    const { fetchBalances } = await import('./balance');
    const result = await fetchBalances();

    expect(result).toEqual({ polymarket: 12.34, sx: 56.78 });

    // Polymarket balance must read pUSD post-V2 cutover (NOT legacy USDC.e 0x2791…4174).
    const tokens = contractMock.mock.calls.map((call) => call[0]);
    expect(tokens).toContain(POLYMARKET_PUSD);
    expect(tokens).toContain(SX_USDC);
    expect(tokens).not.toContain('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  });

  it('returns null for a platform whose RPC call rejects, keeping the other', async () => {
    balanceOfMock
      .mockRejectedValueOnce(new Error('polygon down'))
      .mockResolvedValueOnce(9_000_000n);

    const { fetchBalances } = await import('./balance');
    const result = await fetchBalances();

    expect(result).toEqual({ polymarket: null, sx: 9 });
  });

  it('returns nulls for both when both RPCs fail', async () => {
    balanceOfMock
      .mockRejectedValueOnce(new Error('polygon down'))
      .mockRejectedValueOnce(new Error('sx down'));

    const { fetchBalances } = await import('./balance');
    const result = await fetchBalances();

    expect(result).toEqual({ polymarket: null, sx: null });
  });
});

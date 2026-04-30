import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config } from '../config';
import { createLogger } from '../logger';

const log = createLogger('balance');

const ERC20_BALANCE_ABI = ['function balanceOf(address owner) view returns (uint256)'];

// Polymarket V2 collateral token (pUSD) — replaced USDC.e on the 2026-04-28 CLOB V2 cutover.
const POLYMARKET_PUSD = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB';
const SX_USDC = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const USDC_DECIMALS = 6;
const DIVISOR = 10 ** USDC_DECIMALS;

export interface BalanceSummary {
  polymarket: number | null;
  sx: number | null;
}

async function readErc20Balance(
  rpcUrl: string,
  token: string,
  owner: string,
): Promise<number> {
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = new Contract(token, ERC20_BALANCE_ABI, provider);
  const raw: bigint = await contract.balanceOf(owner);
  return Number(raw) / DIVISOR;
}

export async function fetchBalances(): Promise<BalanceSummary> {
  if (!config.SX_PRIVATE_KEY || !config.POLYMARKET_FUNDER_ADDRESS) {
    throw new Error('Wallet credentials are not configured (READ_ONLY_MODE is active)');
  }
  const sxAddress = new Wallet(config.SX_PRIVATE_KEY).address;

  const [polyResult, sxResult] = await Promise.allSettled([
    readErc20Balance(config.POLYGON_RPC_URL, POLYMARKET_PUSD, config.POLYMARKET_FUNDER_ADDRESS),
    readErc20Balance(config.SX_NETWORK_RPC_URL, SX_USDC, sxAddress),
  ]);

  if (polyResult.status === 'rejected') {
    log.error({ err: polyResult.reason }, 'polymarket RPC failed');
  }
  if (sxResult.status === 'rejected') {
    log.error({ err: sxResult.reason }, 'sx RPC failed');
  }

  return {
    polymarket: polyResult.status === 'fulfilled' ? polyResult.value : null,
    sx: sxResult.status === 'fulfilled' ? sxResult.value : null,
  };
}

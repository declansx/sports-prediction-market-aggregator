import { Wallet, ZeroAddress, ZeroHash, hexlify, randomBytes } from 'ethers';
import { config } from '../config';

const BASE_TOKEN = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const CHAIN_ID = 4162; // SX Mainnet
const EIP712_FILL_HASHER = '0x845a2Da2D70fEDe8474b1C8518200798c60aC364';
const USDC_DECIMALS = 1_000_000;
const ODDS_PRECISION = BigInt('100000000000000000000'); // 10^20

const DOMAIN = {
  name: 'SX Bet',
  version: '6.0',
  chainId: CHAIN_ID,
  verifyingContract: EIP712_FILL_HASHER,
};

const TYPES = {
  Details: [
    { name: 'action', type: 'string' },
    { name: 'market', type: 'string' },
    { name: 'betting', type: 'string' },
    { name: 'stake', type: 'string' },
    { name: 'worstOdds', type: 'string' },
    { name: 'worstReturning', type: 'string' },
    { name: 'fills', type: 'FillObject' },
  ],
  FillObject: [
    { name: 'stakeWei', type: 'string' },
    { name: 'marketHash', type: 'string' },
    { name: 'baseToken', type: 'string' },
    { name: 'desiredOdds', type: 'string' },
    { name: 'oddsSlippage', type: 'uint256' },
    { name: 'isTakerBettingOutcomeOne', type: 'bool' },
    { name: 'fillSalt', type: 'uint256' },
    { name: 'beneficiary', type: 'address' },
    { name: 'beneficiaryType', type: 'uint8' },
    { name: 'cashOutTarget', type: 'bytes32' },
  ],
};

export interface SxFillResult {
  fillHash: string;
  isPartialFill: boolean;
  filledSize: number; // USDC
  fillOdds: number; // 0–1
}

/**
 * Execute a taker fill on SX Bet.
 *
 * @param _gameExternalId  - game-level externalId (not used for execution)
 * @param externalOutcomeId - outcome externalId in format "${specificMarketHash}:0"
 *   where the suffix "0" means isTakerBettingOutcomeOne=true (always the case for 1X2)
 * @param size - USDC amount to stake
 * @param desiredOddsDecimal - worst acceptable taker odds (0–1), e.g. 0.475
 */
export async function executeSxBetFill(
  _gameExternalId: string,
  externalOutcomeId: string,
  size: number,
  desiredOddsDecimal: number,
): Promise<SxFillResult> {
  // Parse the specific binary market hash and outcome direction from the combined externalId
  const colonIdx = externalOutcomeId.lastIndexOf(':');
  if (colonIdx < 0) {
    throw new Error(`Invalid SX Bet outcome externalId (expected "hash:index"): ${externalOutcomeId}`);
  }
  const marketHash = externalOutcomeId.slice(0, colonIdx);
  const outcomeIndex = externalOutcomeId.slice(colonIdx + 1);

  if (!config.SX_PRIVATE_KEY) throw new Error('SX trading credentials are not configured (READ_ONLY_MODE is active)');
  const wallet = new Wallet(config.SX_PRIVATE_KEY);

  const isTakerBettingOutcomeOne = outcomeIndex === '0';
  const stakeWei = String(Math.round(size * USDC_DECIMALS));

  // desiredOdds in SX format: takerImplied * 10^20
  const desiredOdds = String(BigInt(Math.round(desiredOddsDecimal * 1e18)) * BigInt(100));

  const fillSalt = BigInt(hexlify(randomBytes(32))).toString();

  const message = {
    action: 'N/A',
    market: marketHash,
    betting: 'N/A',
    stake: 'N/A',
    worstOdds: 'N/A',
    worstReturning: 'N/A',
    fills: {
      stakeWei,
      marketHash,
      baseToken: BASE_TOKEN,
      desiredOdds,
      oddsSlippage: 0,
      isTakerBettingOutcomeOne,
      fillSalt,
      beneficiary: ZeroAddress,
      beneficiaryType: 0,
      cashOutTarget: ZeroHash,
    },
  };

  const takerSig = await wallet.signTypedData(DOMAIN, TYPES, message);

  const body = {
    market: marketHash,
    baseToken: BASE_TOKEN,
    isTakerBettingOutcomeOne,
    stakeWei,
    desiredOdds,
    oddsSlippage: 0,
    taker: wallet.address,
    takerSig,
    fillSalt,
    message: 'N/A',
  };

  const res = await fetch(`${config.SX_BET_API_URL}/orders/fill/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SX Bet fill failed (${res.status}): ${text}`);
  }

  const result = (await res.json()) as {
    status: string;
    data: {
      fillHash?: string;
      isPartialFill?: boolean;
      bettor?: string;
      stake?: string;
      odds?: string;
    };
  };

  if (result.status !== 'success') {
    throw new Error(`SX Bet fill rejected: ${JSON.stringify(result)}`);
  }

  const fillHash = result.data.fillHash ?? `fill_${fillSalt}`;
  const isPartialFill = result.data.isPartialFill ?? false;

  // Parse fill odds from response (SX format: divide by 10^20)
  let fillOdds = desiredOddsDecimal;
  if (result.data.odds) {
    const rawOdds = BigInt(result.data.odds);
    fillOdds = Number(rawOdds) / Number(ODDS_PRECISION);
  }

  // Actual filled USDC — may be partial
  let filledSize = size;
  if (result.data.stake) {
    filledSize = parseInt(result.data.stake, 10) / USDC_DECIMALS;
  }

  return { fillHash, isPartialFill, filledSize, fillOdds };
}

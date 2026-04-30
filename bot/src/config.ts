import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const readOnlyMode = process.env.READ_ONLY_MODE === 'true';

const requiredUnlessReadOnly = (msg: string) =>
  readOnlyMode ? z.string().optional() : z.string().min(1, msg);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  READ_ONLY_MODE: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_AUTHORIZED_CHAT_ID: z.string().optional(),
  SX_BET_API_URL: z.string().url().default('https://api.sx.bet'),
  SX_BET_API_KEY: z.string().min(1, 'SX_BET_API_KEY is required for real-time Centrifugo connection'),
  SX_BET_WS_URL: z.string().url().default('wss://realtime.sx.bet/connection/websocket'),
  POLYMARKET_API_URL: z.string().url().default('https://clob.polymarket.com'),
  POLYMARKET_FUNDER_ADDRESS: requiredUnlessReadOnly('POLYMARKET_FUNDER_ADDRESS is required — proxy wallet address from polymarket.com/settings'),
  POLYMARKET_API_KEY: requiredUnlessReadOnly('POLYMARKET_API_KEY is required'),
  POLYMARKET_SECRET: requiredUnlessReadOnly('POLYMARKET_SECRET is required'),
  POLYMARKET_PASSPHRASE: requiredUnlessReadOnly('POLYMARKET_PASSPHRASE is required'),
  POLYMARKET_PRIVATE_KEY: requiredUnlessReadOnly('POLYMARKET_PRIVATE_KEY is required'),
  SX_PRIVATE_KEY: requiredUnlessReadOnly('SX_PRIVATE_KEY is required'),
  POLYGON_RPC_URL: z.string().url().default('https://polygon-rpc.com'),
  SX_NETWORK_RPC_URL: z.string().url().default('https://rpc-rollup.sx.technology'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PUBLIC_PORT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`[config] Missing or invalid environment variables:\n${missing}`);
  process.exit(1);
}

export const config = parsed.data;

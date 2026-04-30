import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/test.db',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_AUTHORIZED_CHAT_ID: '123456789',
      POLYMARKET_PRIVATE_KEY: '0x' + '0'.repeat(64),
      SX_PRIVATE_KEY: '0x' + '0'.repeat(64),
      PORT: '3002',
      SX_BET_API_URL: 'https://api.sx.bet',
      SX_BET_API_KEY: 'test-key',
      SX_BET_WS_URL: 'wss://realtime.sx.bet/connection/websocket',
      POLYMARKET_API_URL: 'https://clob.polymarket.com',
      POLYMARKET_FUNDER_ADDRESS: '0x' + '0'.repeat(40),
      POLYMARKET_API_KEY: 'test-key',
      POLYMARKET_SECRET: 'test-secret',
      POLYMARKET_PASSPHRASE: 'test-passphrase',
      POLYGON_RPC_URL: 'https://polygon-rpc.com',
      LOG_LEVEL: 'silent',
    },
  },
});

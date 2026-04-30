import './config'; // validates env vars first — exits process if any are missing
import { config } from './config';
import { prisma } from './db';
import app from './app';
import publicApp from './publicApp';
import { startMarketSync } from './sync/marketSync';
import { startTelegramBot } from './telegram/bot';
import { startWsRelay } from './ws/relay';
import { startCentrifugoService } from './services/centrifugo';
import { startPolymarketWsService } from './services/polymarketWs';
import { startPersistentPolyOddsService } from './services/persistentPolyOdds';
import { startFixtureFinalizer } from './services/sxFixtureService';
import { createLogger } from './logger';

const dbLog = createLogger('db');
const apiLog = createLogger('api');
const publicApiLog = createLogger('api:public');

async function main() {
  try {
    await prisma.$connect();
    dbLog.info('connected');
  } catch (err) {
    dbLog.error({ err }, 'failed to connect');
    process.exit(1);
  }

  const port = Number(config.PORT);

  if (config.READ_ONLY_MODE) {
    const server = publicApp.listen(port, () => {
      publicApiLog.info({ port, logLevel: config.LOG_LEVEL }, 'Public read-only API listening');
      startWsRelay(server);
      startFixtureFinalizer();
      startCentrifugoService();
      startPolymarketWsService();
      startPersistentPolyOddsService();
      startMarketSync();
    });
    return;
  }

  const server = app.listen(port, () => {
    apiLog.info({ port, logLevel: config.LOG_LEVEL }, 'Sports Prediction Market Router API listening');
    startWsRelay(server);
    startFixtureFinalizer();
    startCentrifugoService();
    startPolymarketWsService();
    startPersistentPolyOddsService();
    startMarketSync();
    if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_AUTHORIZED_CHAT_ID) {
      startTelegramBot();
    } else {
      apiLog.info('Telegram bot disabled (TELEGRAM_BOT_TOKEN and/or TELEGRAM_AUTHORIZED_CHAT_ID not set)');
    }
  });

  if (config.PUBLIC_PORT) {
    const publicPort = Number(config.PUBLIC_PORT);
    const publicServer = publicApp.listen(publicPort, () => {
      publicApiLog.info({ port: publicPort }, 'Public read-only API listening');
      startWsRelay(publicServer);
    });
  }
}

main();

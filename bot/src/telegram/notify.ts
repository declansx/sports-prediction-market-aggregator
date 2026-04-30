import { getBotInstance } from './bot';
import { config } from '../config';
import { createLogger } from '../logger';

const log = createLogger('telegram-notify');

export interface TradeNotificationData {
  marketName: string;
  outcomeLabel: string;
  platform: string;
  side: string;
  size: number;
  fillOdds?: number;
  txHash?: string;
  status: 'filled' | 'failed';
  failureReason?: string;
}

export function sendTradeNotification(data: TradeNotificationData): void {
  const bot = getBotInstance();
  if (!bot) return;

  const statusIcon = data.status === 'filled' ? '✅' : '❌';
  const platformLabel = data.platform === 'sx' ? 'SX Bet' : 'Polymarket';
  const oddsStr = data.fillOdds != null ? (data.fillOdds * 100).toFixed(1) + '%' : '—';

  let text =
    `${statusIcon} Trade ${data.status.toUpperCase()}\n` +
    `Market: ${data.marketName}\n` +
    `Outcome: ${data.outcomeLabel}\n` +
    `Side: ${data.side} | Size: $${data.size}\n` +
    `Platform: ${platformLabel} | Odds: ${oddsStr}`;

  if (data.txHash) {
    text += `\nTx: ${data.txHash}`;
  }
  if (data.status === 'failed' && data.failureReason) {
    text += `\nReason: ${data.failureReason}`;
  }

  const chatId = Number(config.TELEGRAM_AUTHORIZED_CHAT_ID);
  bot.api.sendMessage(chatId, text).catch((err: unknown) => {
    log.error({ err, chatId }, 'failed to send trade notification');
  });
}

import type { CommandContext, Context } from 'grammy';
import { prisma } from '../../db';
import { createLogger } from '../../logger';

const log = createLogger('telegram-status');

export async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
  try {
    const lastTrade = await prisma.trade.findFirst({ orderBy: { createdAt: 'desc' } });

    let lastTradeStr = 'No trades yet';
    if (lastTrade) {
      const platformLabel = lastTrade.platform === 'sx' ? 'SX Bet' : 'Polymarket';
      const oddsStr = lastTrade.fillOdds != null
        ? (lastTrade.fillOdds * 100).toFixed(1) + '%'
        : (lastTrade.requestedOdds * 100).toFixed(1) + '% (req)';
      lastTradeStr =
        `${lastTrade.status.toUpperCase()} — $${lastTrade.requestedSize} on ${platformLabel} @ ${oddsStr}`;
    }

    await ctx.reply(
      `*Sports Prediction Market Router Status*\n` +
      `Last trade: ${lastTradeStr}`,
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    log.error({ err }, '/status command failed');
    await ctx.reply('Error fetching status, please try again.');
  }
}

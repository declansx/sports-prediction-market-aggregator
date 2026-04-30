import { Bot, InlineKeyboard, type Context } from 'grammy';
import { config } from '../config';
import { handleStatus } from './commands/status';
import { buildMenuScreen } from './screens/menu';
import { buildSportsScreen } from './screens/sports';
import { buildLeaguesScreen } from './screens/leagues';
import { buildFixturesScreen } from './screens/markets';
import { buildOutcomeScreen } from './screens/outcome';
import { buildHistoryScreen } from './screens/history';
import { pendingTrades } from './session';
import { buildAllocationPlan } from '../router';
import { prisma } from '../db';
import { createPendingTrade, markTradeFilled, markTradeFailed } from '../db/trades';
import { executeSxBetFill } from '../executor/sxbet';
import { executePolymarketOrder } from '../executor/polymarket';
import { sendTradeNotification } from './notify';
import { buildGameScreen, buildGame1x2Screen, buildGameLinesScreen, buildSpreadLinesScreen, buildTotalLinesScreen } from './screens/game';
import { registerLiveScreen, clearLiveScreen, startLiveScreenUpdater } from './liveScreens';
import type { Allocation } from '../types';
import { createLogger } from '../logger';

const log = createLogger('telegram');

let botInstance: Bot | null = null;

export function getBotInstance(): Bot | null {
  return botInstance;
}

async function executeAllocation(allocation: Allocation): Promise<string> {
  if (allocation.platform === 'sx') {
    const fill = await executeSxBetFill(
      allocation.externalMarketId,
      allocation.externalOutcomeId,
      allocation.size,
      allocation.expectedOdds,
    );
    return fill.fillHash;
  }
  if (allocation.platform === 'polymarket') {
    const order = await executePolymarketOrder(
      allocation.externalOutcomeId,
      allocation.size,
      allocation.expectedOdds,
    );
    return order.orderId;
  }
  throw new Error(`Unknown platform: ${allocation.platform}`);
}

export function startTelegramBot(): void {
  if (!config.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  botInstance = bot;
  startLiveScreenUpdater(bot);

  // Auth middleware — silently drop all messages from unauthorized chats
  bot.use((ctx, next) => {
    if (ctx.chat?.id.toString() !== config.TELEGRAM_AUTHORIZED_CHAT_ID) {
      return;
    }
    return next();
  });

  bot.command('status', handleStatus);

  bot.command('menu', async (ctx) => {
    clearLiveScreen(ctx.chat.id);
    const screen = await buildMenuScreen();
    await ctx.reply(screen.text, { parse_mode: 'HTML', reply_markup: screen.reply_markup });
  });

  // Handle pending trade size input
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    const chatId = ctx.chat.id;
    const session = pendingTrades.get(chatId);
    if (!session) return;

    const sizeText = ctx.message.text.trim();
    const size = parseFloat(sizeText);

    if (isNaN(size) || size <= 0) {
      await ctx.reply('Please enter a valid number greater than 0.');
      return;
    }

    const result = await buildAllocationPlan(session.outcomeId, 'buy', size);

    if (!result.ok) {
      await ctx.reply(`Preview failed: ${result.error.message}\n\nEnter a different size or tap Cancel in the trade prompt.`);
      return;
    }

    session.size = size;
    pendingTrades.set(chatId, session);

    const { plan } = result;

    const allocs = plan.allocations
      .map((a) => {
        const platform = a.platform === 'sx' ? 'SX Bet' : 'Polymarket';
        return `${platform}: $${a.size.toFixed(2)} @ ${(a.expectedOdds * 100).toFixed(2)}%`;
      })
      .join('\n');

    const previewText =
      `<b>Trade Preview: ${escHtml(session.outcomeLabel)}</b>\n\n` +
      `Weighted odds: ${(plan.weightedOdds * 100).toFixed(2)}%\n` +
      `Total slippage: ${(plan.totalSlippage * 100).toFixed(2)}%\n\n` +
      `${allocs}\n\n` +
      `Total: $${size.toFixed(2)}`;

    const kb = new InlineKeyboard().text('✅ Execute', 'exec').text('❌ Cancel', 'cancel');

    if (session.promptMessageId) {
      try {
        await ctx.api.editMessageText(chatId, session.promptMessageId, previewText, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        // fall through to reply if edit fails (e.g. message too old)
      }
    }
    await ctx.reply(previewText, { parse_mode: 'HTML', reply_markup: kb });
  });

  // Callback query dispatcher
  bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat?.id ?? 0;

    try {
      if (data === 'noop') {
        return;
      }

      if (data === 'menu') {
        clearLiveScreen(chatId);
        const screen = await buildMenuScreen();
        await editOrReply(ctx, screen.text, screen.reply_markup);
        return;
      }

      // Sports screen — entry point for market browsing
      if (data === 'markets') {
        clearLiveScreen(chatId);
        const screen = await buildSportsScreen();
        await editOrReply(ctx, screen.text, screen.reply_markup);
        return;
      }

      // sport:<sport>
      if (data.startsWith('sport:')) {
        clearLiveScreen(chatId);
        const sport = data.slice('sport:'.length);
        const screen = await buildLeaguesScreen(sport);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        return;
      }

      // league:<sport>:<league>:<page>
      if (data.startsWith('league:')) {
        clearLiveScreen(chatId);
        const parts = data.split(':');
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[1];
        const league = parts.slice(2, parts.length - 1).join(':');
        const screen = await buildFixturesScreen(sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        return;
      }

      // game:<marketId>:<sport>:<league>:<page> — bet-type selector
      if (data.startsWith('game:') && !data.startsWith('game1x2:') && !data.startsWith('gamegl:') && !data.startsWith('gamespread:') && !data.startsWith('gametotal:')) {
        const parts = data.split(':');
        const marketId = parts[1];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[2];
        const league = parts.slice(3, parts.length - 1).join(':');
        const screen = await buildGameScreen(marketId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildGameScreen(marketId, sport, league, page));
        return;
      }

      // game1x2:<marketId>:<sport>:<league>:<page>
      if (data.startsWith('game1x2:')) {
        const parts = data.slice('game1x2:'.length).split(':');
        const marketId = parts[0];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[1];
        const league = parts.slice(2, parts.length - 1).join(':');
        const screen = await buildGame1x2Screen(marketId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildGame1x2Screen(marketId, sport, league, page));
        return;
      }

      // gamegl:<marketId>:<sport>:<league>:<page>
      if (data.startsWith('gamegl:')) {
        const parts = data.slice('gamegl:'.length).split(':');
        const marketId = parts[0];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[1];
        const league = parts.slice(2, parts.length - 1).join(':');
        const screen = await buildGameLinesScreen(marketId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildGameLinesScreen(marketId, sport, league, page));
        return;
      }

      // gamespread:<marketId>:<sport>:<league>:<page>
      if (data.startsWith('gamespread:')) {
        const parts = data.slice('gamespread:'.length).split(':');
        const marketId = parts[0];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[1];
        const league = parts.slice(2, parts.length - 1).join(':');
        const screen = await buildSpreadLinesScreen(marketId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildSpreadLinesScreen(marketId, sport, league, page));
        return;
      }

      // gametotal:<marketId>:<sport>:<league>:<page>
      if (data.startsWith('gametotal:')) {
        const parts = data.slice('gametotal:'.length).split(':');
        const marketId = parts[0];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[1];
        const league = parts.slice(2, parts.length - 1).join(':');
        const screen = await buildTotalLinesScreen(marketId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildTotalLinesScreen(marketId, sport, league, page));
        return;
      }

      // outcome:<outcomeId>:<sport>:<league>:<page>
      if (data.startsWith('outcome:')) {
        const parts = data.split(':');
        const outcomeId = parts[1];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[2];
        const league = parts.slice(3, parts.length - 1).join(':');
        const screen = await buildOutcomeScreen(outcomeId, sport, league, page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) registerLiveScreen(chatId, messageId, () => buildOutcomeScreen(outcomeId, sport, league, page));
        return;
      }

      if (data.startsWith('history:')) {
        clearLiveScreen(chatId);
        const page = parseInt(data.split(':')[1], 10);
        const screen = await buildHistoryScreen(page);
        await editOrReply(ctx, screen.text, screen.reply_markup);
        return;
      }

      // trade:<outcomeId>:<sport>:<league>:<page>
      if (data.startsWith('trade:')) {
        clearLiveScreen(chatId);
        const parts = data.split(':');
        const outcomeId = parts[1];
        const page = parseInt(parts[parts.length - 1], 10);
        const sport = parts[2];
        const league = parts.slice(3, parts.length - 1).join(':');

        const outcome = await prisma.outcome.findUnique({
          where: { id: outcomeId },
          select: { label: true, marketId: true },
        });

        const promptText = `💰 <b>Trade: ${escHtml(outcome?.label ?? 'Unknown')}</b>\n\nEnter trade size in USDC:`;
        await editOrReply(ctx, promptText, new InlineKeyboard());
        const promptMessageId = ctx.callbackQuery.message?.message_id;

        pendingTrades.set(chatId, {
          outcomeId,
          outcomeLabel: outcome?.label ?? '',
          marketId: outcome?.marketId ?? '',
          league,
          sport,
          page,
          promptMessageId,
        });
        return;
      }

      if (data === 'exec') {
        clearLiveScreen(chatId);
        const session = pendingTrades.get(chatId);

        if (!session || session.size == null) {
          await editOrReply(
            ctx,
            'No pending trade found. Use /menu to start over.',
            new InlineKeyboard().text('↩ Menu', 'menu'),
          );
          return;
        }

        pendingTrades.delete(chatId);

        const result = await buildAllocationPlan(session.outcomeId, 'buy', session.size);

        if (!result.ok) {
          await editOrReply(
            ctx,
            `Trade failed: ${escHtml(result.error.message)}`,
            new InlineKeyboard().text('↩ Menu', 'menu'),
          );
          return;
        }

        const { plan } = result;
        const tradeResults: Array<{ status: string; platform: string; txHash?: string }> = [];

        for (const allocation of plan.allocations) {
          const outcomeRow = await prisma.outcome.findUnique({
            where: { id: allocation.outcomeId },
            select: { marketId: true, label: true, market: { select: { event: { select: { homeTeam: true, awayTeam: true } } } } },
          });

          if (!outcomeRow) {
            tradeResults.push({ status: 'failed', platform: allocation.platform });
            continue;
          }

          const tradeId = await createPendingTrade({
            marketId: outcomeRow.marketId,
            outcomeId: allocation.outcomeId,
            platform: allocation.platform,
            side: 'buy',
            requestedSize: allocation.size,
            requestedOdds: allocation.expectedOdds,
          });

          log.info(
            { tradeId, platform: allocation.platform, outcomeId: allocation.outcomeId, size: allocation.size, expectedOdds: allocation.expectedOdds, source: 'telegram' },
            'trade requested',
          );

          try {
            const txHash = await executeAllocation(allocation);
            await markTradeFilled(tradeId, txHash, allocation.size, allocation.expectedOdds);
            tradeResults.push({ status: 'filled', platform: allocation.platform, txHash });
            log.info(
              { tradeId, platform: allocation.platform, txHash, fillOdds: allocation.expectedOdds, size: allocation.size },
              'trade filled',
            );
            sendTradeNotification({
              marketName: `${outcomeRow.market.event.homeTeam} vs ${outcomeRow.market.event.awayTeam}`,
              outcomeLabel: outcomeRow.label,
              platform: allocation.platform,
              side: 'buy',
              size: allocation.size,
              fillOdds: allocation.expectedOdds,
              txHash,
              status: 'filled',
            });
          } catch (err) {
            const reason = err instanceof Error ? err.message : 'unknown_error';
            await markTradeFailed(tradeId, reason);
            tradeResults.push({ status: 'failed', platform: allocation.platform });
            log.error({ err, tradeId, platform: allocation.platform, reason }, 'trade failed');
            sendTradeNotification({
              marketName: `${outcomeRow.market.event.homeTeam} vs ${outcomeRow.market.event.awayTeam}`,
              outcomeLabel: outcomeRow.label,
              platform: allocation.platform,
              side: 'buy',
              size: allocation.size,
              status: 'failed',
              failureReason: reason,
            });
          }
        }

        const allFilled = tradeResults.every((t) => t.status === 'filled');
        const anyFilled = tradeResults.some((t) => t.status === 'filled');
        const statusEmoji = allFilled ? '✅' : anyFilled ? '⚠️' : '❌';
        const statusLabel = allFilled ? 'Trade executed' : anyFilled ? 'Partial fill' : 'Trade failed';

        const resultLines = tradeResults
          .map((t) => {
            const platform = t.platform === 'sx' ? 'SX Bet' : 'Polymarket';
            const tx = t.txHash ? ` (${t.txHash.slice(0, 8)}…)` : '';
            return `${platform}: ${t.status}${tx}`;
          })
          .join('\n');

        const resultKb = new InlineKeyboard()
          .text('📜 History', 'history:0')
          .text('↩ Menu', 'menu');

        await editOrReply(
          ctx,
          `${statusEmoji} <b>${statusLabel}</b>\n\n${resultLines}`,
          resultKb,
        );
        return;
      }

      if (data === 'cancel') {
        const session = pendingTrades.get(chatId);
        pendingTrades.delete(chatId);

        if (session) {
          const sport = session.sport ?? '';
          const { marketId, league, page } = session;
          const screen = await buildGameScreen(marketId, sport, league, page);
          await editOrReply(ctx, screen.text, screen.reply_markup);
          const messageId = ctx.callbackQuery.message?.message_id;
          if (messageId) registerLiveScreen(chatId, messageId, () => buildGameScreen(marketId, sport, league, page));
        } else {
          clearLiveScreen(chatId);
          const screen = await buildMenuScreen();
          await editOrReply(ctx, screen.text, screen.reply_markup);
        }
        return;
      }
    } catch (err) {
      log.error({ err, chatId, data }, 'callback handler error');
      try {
        await editOrReply(
          ctx,
          'Error loading data — tap below to retry.',
          new InlineKeyboard().text('🔄 Retry', data).text('↩ Menu', 'menu'),
        );
      } catch {
        // ignore secondary error
      }
    }
  });

  bot.catch((err) => {
    log.error({ err }, 'unhandled bot error');
  });

  bot.start({
    onStart: () => log.info('bot started (long-polling)'),
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function editOrReply(ctx: Context, text: string, reply_markup: InlineKeyboard): Promise<void> {
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('message is not modified')) return;
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup });
  }
}

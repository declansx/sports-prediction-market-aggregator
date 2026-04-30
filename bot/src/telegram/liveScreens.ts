import type { Bot, InlineKeyboard } from 'grammy';
import { oddsCache } from '../services/oddsCache';
import { polymarketOddsCache } from '../services/polymarketOddsCache';
import { createLogger } from '../logger';

const log = createLogger('liveScreens');

export type LiveRender = () => Promise<{ text: string; reply_markup: InlineKeyboard }>;

interface Entry {
  messageId: number;
  render: LiveRender;
  timer: NodeJS.Timeout | null;
}

const DEBOUNCE_MS = 750;

const registry = new Map<number, Entry>();

export function registerLiveScreen(chatId: number, messageId: number, render: LiveRender): void {
  const existing = registry.get(chatId);
  if (existing?.timer) clearTimeout(existing.timer);
  registry.set(chatId, { messageId, render, timer: null });
}

export function clearLiveScreen(chatId: number): void {
  const existing = registry.get(chatId);
  if (existing?.timer) clearTimeout(existing.timer);
  registry.delete(chatId);
}

function isTerminalEditError(msg: string): boolean {
  return (
    msg.includes('message to edit not found') ||
    msg.includes('message is too old') ||
    msg.includes('MESSAGE_ID_INVALID') ||
    msg.includes('message can\'t be edited') ||
    msg.includes('chat not found')
  );
}

async function flush(bot: Bot, chatId: number): Promise<void> {
  const entry = registry.get(chatId);
  if (!entry) return;
  entry.timer = null;

  let screen: { text: string; reply_markup: InlineKeyboard };
  try {
    screen = await entry.render();
  } catch (err) {
    log.error({ err, chatId }, 'renderer failed');
    return;
  }

  try {
    await bot.api.editMessageText(chatId, entry.messageId, screen.text, {
      parse_mode: 'HTML',
      reply_markup: screen.reply_markup,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('message is not modified')) return;
    if (isTerminalEditError(msg)) {
      clearLiveScreen(chatId);
      return;
    }
    log.error({ err, chatId }, 'editMessageText failed');
  }
}

function scheduleFlush(bot: Bot, chatId: number): void {
  const entry = registry.get(chatId);
  if (!entry) return;
  if (entry.timer) return;
  entry.timer = setTimeout(() => {
    void flush(bot, chatId);
  }, DEBOUNCE_MS);
}

function fanOut(bot: Bot): void {
  for (const chatId of registry.keys()) {
    scheduleFlush(bot, chatId);
  }
}

let started = false;

export function startLiveScreenUpdater(bot: Bot): void {
  if (started) return;
  started = true;
  oddsCache.on('update', () => fanOut(bot));
  polymarketOddsCache.on('polyOddsUpdate', () => fanOut(bot));
}

export function __resetForTests(): void {
  for (const entry of registry.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  registry.clear();
  started = false;
  oddsCache.removeAllListeners('update');
  polymarketOddsCache.removeAllListeners('polyOddsUpdate');
}

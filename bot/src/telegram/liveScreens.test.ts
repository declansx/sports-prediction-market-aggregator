import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InlineKeyboard } from 'grammy';
import {
  registerLiveScreen,
  clearLiveScreen,
  startLiveScreenUpdater,
  __resetForTests,
} from './liveScreens';
import { oddsCache } from '../services/oddsCache';
import { polymarketOddsCache } from '../services/polymarketOddsCache';

function makeBot() {
  const editMessageText = vi.fn().mockResolvedValue(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { api: { editMessageText } } as any;
}

function makeRender(text = 'hello') {
  return vi.fn().mockResolvedValue({
    text,
    reply_markup: new InlineKeyboard().text('x', 'noop'),
  });
}

describe('liveScreens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetForTests();
  });

  afterEach(() => {
    __resetForTests();
    vi.useRealTimers();
  });

  it('register replaces prior entry and old render is not invoked on next flush', async () => {
    const bot = makeBot();
    startLiveScreenUpdater(bot);

    const oldRender = makeRender('old');
    const newRender = makeRender('new');
    registerLiveScreen(42, 100, oldRender);
    registerLiveScreen(42, 101, newRender);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);

    expect(oldRender).not.toHaveBeenCalled();
    expect(newRender).toHaveBeenCalledTimes(1);
    expect(bot.api.editMessageText).toHaveBeenCalledTimes(1);
    expect(bot.api.editMessageText).toHaveBeenCalledWith(42, 101, 'new', expect.any(Object));
  });

  it('debounces bursty oddsCache updates into a single editMessageText call', async () => {
    const bot = makeBot();
    startLiveScreenUpdater(bot);

    const render = makeRender();
    registerLiveScreen(7, 200, render);

    for (let i = 0; i < 5; i++) oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);

    expect(render).toHaveBeenCalledTimes(1);
    expect(bot.api.editMessageText).toHaveBeenCalledTimes(1);
  });

  it('polymarketOddsCache polyOddsUpdate also triggers a flush', async () => {
    const bot = makeBot();
    startLiveScreenUpdater(bot);

    const render = makeRender();
    registerLiveScreen(9, 300, render);

    polymarketOddsCache.emit('polyOddsUpdate', {} as never);
    await vi.advanceTimersByTimeAsync(800);

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('clearLiveScreen cancels pending flush and removes entry', async () => {
    const bot = makeBot();
    startLiveScreenUpdater(bot);

    const render = makeRender();
    registerLiveScreen(1, 1, render);
    oddsCache.emit('update', {} as never);
    clearLiveScreen(1);

    await vi.advanceTimersByTimeAsync(800);

    expect(render).not.toHaveBeenCalled();
    expect(bot.api.editMessageText).not.toHaveBeenCalled();
  });

  it('"message is not modified" error does not clear the entry', async () => {
    const bot = makeBot();
    bot.api.editMessageText
      .mockRejectedValueOnce(new Error('Bad Request: message is not modified'))
      .mockResolvedValueOnce(true);
    startLiveScreenUpdater(bot);

    const render = makeRender();
    registerLiveScreen(3, 30, render);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);
    expect(render).toHaveBeenCalledTimes(1);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('"message to edit not found" clears the entry', async () => {
    const bot = makeBot();
    bot.api.editMessageText.mockRejectedValue(
      new Error('Bad Request: message to edit not found'),
    );
    startLiveScreenUpdater(bot);

    const render = makeRender();
    registerLiveScreen(4, 40, render);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);
    expect(render).toHaveBeenCalledTimes(1);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('fans out a single event to all registered chats', async () => {
    const bot = makeBot();
    startLiveScreenUpdater(bot);

    const r1 = makeRender('a');
    const r2 = makeRender('b');
    registerLiveScreen(10, 1000, r1);
    registerLiveScreen(20, 2000, r2);

    oddsCache.emit('update', {} as never);
    await vi.advanceTimersByTimeAsync(800);

    expect(r1).toHaveBeenCalledTimes(1);
    expect(r2).toHaveBeenCalledTimes(1);
    expect(bot.api.editMessageText).toHaveBeenCalledTimes(2);
  });
});

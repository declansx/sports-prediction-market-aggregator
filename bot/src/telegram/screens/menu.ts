import { InlineKeyboard } from 'grammy';

export async function buildMenuScreen(): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const text = '<b>Sports Prediction Market Router</b>';

  const kb = new InlineKeyboard()
    .text('📊 Markets', 'markets')
    .row()
    .text('📜 History', 'history:0');

  return { text, reply_markup: kb };
}

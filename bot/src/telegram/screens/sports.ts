import { InlineKeyboard } from 'grammy';
import { getMarketGroups } from '../../services/marketGroups';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildSportsScreen(): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const groups = await getMarketGroups();

  const counts = new Map<string, number>();
  for (const g of groups) {
    counts.set(g.sport, (counts.get(g.sport) ?? 0) + 1);
  }

  const kb = new InlineKeyboard();

  if (counts.size === 0) {
    kb.text('↩ Menu', 'menu');
    return { text: '<b>Markets</b>\n\nNo active markets available.', reply_markup: kb };
  }

  const text = '<b>Markets</b>\n\nSelect a sport:';

  for (const sport of [...counts.keys()].sort()) {
    kb.text(`${esc(sport)} (${counts.get(sport)})`, `sport:${sport}`);
    kb.row();
  }

  kb.text('↩ Menu', 'menu');

  return { text, reply_markup: kb };
}

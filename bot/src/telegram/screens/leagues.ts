import { InlineKeyboard } from 'grammy';
import { getMarketGroups } from '../../services/marketGroups';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildLeaguesScreen(sport: string): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const groups = await getMarketGroups();

  const counts = new Map<string, number>();
  for (const g of groups) {
    if (g.sport !== sport) continue;
    counts.set(g.league, (counts.get(g.league) ?? 0) + 1);
  }

  const kb = new InlineKeyboard();

  if (counts.size === 0) {
    kb.text('↩ Back', 'markets').text('↩ Menu', 'menu');
    return {
      text: `<b>${esc(sport)}</b>\n\nNo leagues available.`,
      reply_markup: kb,
    };
  }

  const text = `<b>${esc(sport)}</b>\n\nSelect a league:`;

  for (const league of [...counts.keys()].sort()) {
    kb.text(`${esc(league)} (${counts.get(league)})`, `league:${sport}:${league}:0`);
    kb.row();
  }

  kb.text('↩ Sports', 'markets');

  return { text, reply_markup: kb };
}

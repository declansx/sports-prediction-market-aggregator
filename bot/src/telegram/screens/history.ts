import { InlineKeyboard } from 'grammy';
import { prisma } from '../../db';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PAGE_SIZE = 5;

export async function buildHistoryScreen(
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const total = await prisma.trade.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const trades = await prisma.trade.findMany({
    skip: safePage * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: { createdAt: 'desc' },
    include: {
      market: { select: { event: { select: { homeTeam: true, awayTeam: true } } } },
      outcome: { select: { label: true } },
    },
  });

  let text = `<b>Trade History</b> — Page ${safePage + 1}/${totalPages} (${total} total)\n\n`;

  if (trades.length === 0) {
    text += 'No trades yet.';
  } else {
    text += trades
      .map((t) => {
        const date = new Date(t.createdAt).toLocaleString('en-GB', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        });
        const marketName = `${t.market.event.homeTeam} vs ${t.market.event.awayTeam}`;
        const marketShort = marketName.length > 22 ? marketName.slice(0, 20) + '…' : marketName;
        const size = (t.executedSize ?? t.requestedSize).toFixed(0);
        const odds = t.fillOdds ?? t.requestedOdds;
        const oddsStr = (odds * 100).toFixed(1) + '%';
        const statusEmoji = t.status === 'filled' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
        const txShort = t.txHash ? t.txHash.slice(0, 8) + '…' : '—';
        const platform = t.platform === 'sx' ? 'SX' : 'POLY';
        return (
          `${statusEmoji} ${date}\n` +
          `${esc(marketShort)} · ${esc(t.outcome.label)}\n` +
          `${platform} ${t.side} $${size} @ ${oddsStr} · ${txShort}`
        );
      })
      .join('\n\n');
  }

  const kb = new InlineKeyboard();
  if (safePage > 0) kb.text('◀ Prev', `history:${safePage - 1}`);
  else kb.text('·', 'noop');
  kb.text(`${safePage + 1}/${totalPages}`, 'noop');
  if (safePage < totalPages - 1) kb.text('Next ▶', `history:${safePage + 1}`);
  else kb.text('·', 'noop');
  kb.row();
  kb.text('↩ Menu', 'menu');

  return { text, reply_markup: kb };
}

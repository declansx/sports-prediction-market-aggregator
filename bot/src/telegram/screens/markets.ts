import { InlineKeyboard } from 'grammy';
import { fixtureStateCache, FIXTURE_STATUS } from '../../services/fixtureStateCache';
import { getMarketGroups, type MarketGroup } from '../../services/marketGroups';

const PAGE_SIZE = 5;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatLivePrefix(sxEventId: string | null | undefined): string | null {
  if (!sxEventId) return null;
  const state = fixtureStateCache.get(sxEventId);
  if (!state || state.status !== FIXTURE_STATUS.IN_PROGRESS) return null;
  const parts = ['🔴'];
  if (state.currentPeriod) parts.push(state.currentPeriod);
  if (state.periodTime && state.periodTime !== '-1') parts.push(state.periodTime);
  parts.push(`· ${state.teamOneScore}-${state.teamTwoScore}`);
  return parts.join(' ');
}

// Pick a single marketId to use as the callback target for a group —
// prefer SX so the game/outcome screens' SX-centric paths stay fast; fall back to Polymarket.
function primaryMarketId(group: MarketGroup): string {
  const sx = group.markets.find((m) => m.platform === 'sx');
  return sx?.id ?? group.markets[0].id;
}

export async function buildFixturesScreen(
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const allGroups = await getMarketGroups();
  const fixtures = allGroups.filter((g) => g.sport === sport && g.league === league);

  const kb = new InlineKeyboard();

  if (fixtures.length === 0) {
    kb.text('↩ Back', `sport:${sport}`).text('↩ Menu', 'menu');
    return {
      text: `<b>${esc(league)}</b>\n\nNo fixtures available.`,
      reply_markup: kb,
    };
  }

  const totalPages = Math.max(1, Math.ceil(fixtures.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = fixtures.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  let text = `<b>${esc(league)}</b> — Fixtures\n\n`;
  text += slice
    .map((f) => {
      const live = formatLivePrefix(f.sxEventId);
      if (live) return `${esc(live)}\n<b>${esc(f.name)}</b>`;
      const dt = `${f.startTime.toLocaleString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
      })} ET`;
      return `${dt}\n<b>${esc(f.name)}</b>`;
    })
    .join('\n\n');

  for (const f of slice) {
    const label = f.name.length > 40 ? f.name.slice(0, 38) + '…' : f.name;
    kb.text(label, `game:${primaryMarketId(f)}:${sport}:${league}:${safePage}`);
    kb.row();
  }

  if (safePage > 0) kb.text('◀ Prev', `league:${sport}:${league}:${safePage - 1}`);
  else kb.text('·', 'noop');
  kb.text(`${safePage + 1}/${totalPages}`, 'noop');
  if (safePage < totalPages - 1) kb.text('Next ▶', `league:${sport}:${league}:${safePage + 1}`);
  else kb.text('·', 'noop');
  kb.row();

  kb.text('↩ Leagues', `sport:${sport}`).text('↩ Menu', 'menu');

  return { text, reply_markup: kb };
}

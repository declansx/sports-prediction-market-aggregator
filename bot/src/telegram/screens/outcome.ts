import { InlineKeyboard } from 'grammy';
import { getMarketGroups } from '../../services/marketGroups';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildOutcomeScreen(
  outcomeId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const groups = await getMarketGroups();

  let selectedGroup = null as (typeof groups)[number] | null;
  let selectedMarket = null as (typeof groups)[number]['markets'][number] | null;
  let selectedOutcome = null as (typeof groups)[number]['markets'][number]['outcomes'][number] | null;

  outer: for (const g of groups) {
    for (const m of g.markets) {
      for (const o of m.outcomes) {
        if (o.id === outcomeId) {
          selectedGroup = g;
          selectedMarket = m;
          selectedOutcome = o;
          break outer;
        }
      }
    }
  }

  if (!selectedGroup || !selectedMarket || !selectedOutcome) {
    const kb = new InlineKeyboard().text('↩ Menu', 'menu');
    return { text: 'Market no longer available.', reply_markup: kb };
  }

  const backData = `game:${selectedMarket.id}:${sport}:${league}:${page}`;

  // Find counterpart on the other platform with matching betType + line + label.
  const otherPlatform = selectedMarket.platform === 'sx' ? 'polymarket' : 'sx';
  let counterpart: typeof selectedOutcome | null = null;
  for (const m of selectedGroup.markets) {
    if (m.platform !== otherPlatform) continue;
    if (m.betType !== selectedMarket.betType) continue;
    if ((m.line ?? null) !== (selectedMarket.line ?? null)) continue;
    const match = m.outcomes.find((o) => o.label === selectedOutcome!.label);
    if (match) {
      counterpart = match;
      break;
    }
  }

  const sxOutcome = selectedMarket.platform === 'sx' ? selectedOutcome : counterpart;
  const polyOutcome = selectedMarket.platform === 'polymarket' ? selectedOutcome : counterpart;

  const dt = `${selectedGroup.startTime.toLocaleString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })} ET`;

  let text = `<b>${esc(selectedOutcome.label)}</b>\n`;
  text += `${esc(selectedGroup.name)}\n`;
  text += `${esc(selectedGroup.league)} · ${dt}\n\n`;

  if (sxOutcome) {
    const decimal = (1 / sxOutcome.impliedOdds).toFixed(2);
    text += `SX Bet:     ${(sxOutcome.impliedOdds * 100).toFixed(1)}% (${decimal}x) · $${sxOutcome.availableSize.toFixed(0)} avail\n`;
  } else {
    text += `SX Bet:     not available\n`;
  }

  if (polyOutcome) {
    const decimal = (1 / polyOutcome.impliedOdds).toFixed(2);
    text += `Polymarket: ${(polyOutcome.impliedOdds * 100).toFixed(1)}% (${decimal}x) · $${polyOutcome.availableSize.toFixed(0)} avail\n`;
  } else {
    text += `Polymarket: not available\n`;
  }

  if (sxOutcome && polyOutcome) {
    const bestPlatform = sxOutcome.impliedOdds <= polyOutcome.impliedOdds ? 'SX Bet' : 'Polymarket';
    text += `\nBest price: <b>${bestPlatform}</b>`;
  }

  const kb = new InlineKeyboard()
    .text('💰 Trade', `trade:${outcomeId}:${sport}:${league}:${page}`)
    .text('↩ Back', backData);

  return { text, reply_markup: kb };
}

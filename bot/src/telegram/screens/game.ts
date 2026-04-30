import { InlineKeyboard } from 'grammy';
import { formatLivePrefix } from './markets';
import { getMarketGroups, type MarketGroup, type OverlaidMarket } from '../../services/marketGroups';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtOdds(odds: number): string {
  return `${(odds * 100).toFixed(1)}%`;
}

function fmtDate(d: Date): string {
  const s = d.toLocaleString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
  return `${s} ET`;
}

async function findGroup(marketId: string): Promise<MarketGroup | null> {
  const groups = await getMarketGroups();
  return groups.find((g) => g.marketIds.includes(marketId)) ?? null;
}

function headerLine(group: MarketGroup, dt: string): string {
  const live = formatLivePrefix(group.sxEventId);
  return live ? `${esc(live)} · ${esc(group.league)}` : `${esc(group.league)} · ${dt}`;
}

function suffix(marketId: string, sport: string, league: string, page: number): string {
  return `${marketId}:${sport}:${league}:${page}`;
}

function notAvailable(): { text: string; reply_markup: InlineKeyboard } {
  const kb = new InlineKeyboard().text('↩ Menu', 'menu');
  return { text: 'Market no longer available.', reply_markup: kb };
}

// Screen 1: Bet-type selector (soccer only) — non-soccer bypasses to game lines directly
export async function buildGameScreen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  if (sport !== 'Soccer') {
    return buildGameLinesScreen(marketId, sport, league, page);
  }

  const group = await findGroup(marketId);
  if (!group) return notAvailable();

  const sfx = suffix(marketId, sport, league, page);
  const dt = fmtDate(group.startTime);
  const text = `<b>${esc(group.name)}</b>\n${headerLine(group, dt)}\n\nSelect a market type:`;

  const kb = new InlineKeyboard()
    .text('1X2', `game1x2:${sfx}`)
    .text('Game Lines', `gamegl:${sfx}`)
    .row()
    .text('↩ Fixtures', `league:${sport}:${league}:${page}`)
    .text('↩ Menu', 'menu');

  return { text, reply_markup: kb };
}

// Screen 2: 1X2 outcomes — paired 2 per row
export async function buildGame1x2Screen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const group = await findGroup(marketId);
  if (!group) return notAvailable();

  const sfx = suffix(marketId, sport, league, page);
  const backData = `game:${sfx}`;
  const dt = fmtDate(group.startTime);
  const header = `<b>${esc(group.name)} — 1X2</b>\n${headerLine(group, dt)}`;

  // Prefer SX outcomeId per label across all 1x2 markets in the group (SX + Polymarket).
  const byLabel = new Map<string, { outcomeId: string; odds: number; platform: 'sx' | 'polymarket' }>();
  for (const m of group.markets) {
    if (m.betType !== '1x2') continue;
    for (const o of m.outcomes) {
      const cur = byLabel.get(o.label);
      if (!cur || m.platform === 'sx') {
        byLabel.set(o.label, { outcomeId: o.id, odds: o.impliedOdds, platform: m.platform });
      }
    }
  }

  const kb = new InlineKeyboard();

  if (byLabel.size === 0) {
    kb.text('↩ Back', backData).text('↩ Menu', 'menu');
    return { text: header + '\n\nNo 1X2 markets available.', reply_markup: kb };
  }

  const used = new Set<string>();
  for (const [label, g] of byLabel) {
    if (used.has(label)) continue;
    if (label.startsWith('Not ')) continue;

    const notLabel = `Not ${label}`;
    const partner = byLabel.get(notLabel);

    const btnA = `${esc(label)}  ${fmtOdds(g.odds)}`;
    if (partner && !used.has(notLabel)) {
      const btnB = `${esc(notLabel)}  ${fmtOdds(partner.odds)}`;
      kb.text(btnA, `outcome:${g.outcomeId}:${sport}:${league}:${page}`)
        .text(btnB, `outcome:${partner.outcomeId}:${sport}:${league}:${page}`)
        .row();
      used.add(label);
      used.add(notLabel);
    } else {
      kb.text(btnA, `outcome:${g.outcomeId}:${sport}:${league}:${page}`).row();
      used.add(label);
    }
  }

  kb.text('↩ Back', backData).text('↩ Menu', 'menu');
  return { text: header, reply_markup: kb };
}

// Screen 3: Game Lines — ML + main spread + main total, paired 2 per row
export async function buildGameLinesScreen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const group = await findGroup(marketId);
  if (!group) return notAvailable();

  const sfx = suffix(marketId, sport, league, page);
  const backData = `game:${sfx}`;
  const dt = fmtDate(group.startTime);
  const header = `<b>${esc(group.name)} — Game Lines</b>\n${headerLine(group, dt)}`;

  const glMarkets = group.markets.filter((m) => ['12', 'spread', 'total'].includes(m.betType));

  const mlMarket = glMarkets.find((m) => m.betType === '12');
  const mainSpread = glMarkets.find((m) => m.betType === 'spread' && m.mainLine);
  const mainTotal = glMarkets.find((m) => m.betType === 'total' && m.mainLine);

  if (!mlMarket && !mainSpread && !mainTotal) {
    const kb = new InlineKeyboard()
      .text('↩ Back', backData)
      .text('↩ Menu', 'menu');
    return { text: header + '\n\nNo game lines available.', reply_markup: kb };
  }

  let text = header;
  const kb = new InlineKeyboard();

  if (mlMarket && mlMarket.outcomes.length >= 2) {
    text += '\n\n<b>Moneyline</b>';
    const [o1, o2] = mlMarket.outcomes;
    kb.text(`${esc(o1.label)} ML  ${fmtOdds(o1.impliedOdds)}`, `outcome:${o1.id}:${sport}:${league}:${page}`)
      .text(`${esc(o2.label)} ML  ${fmtOdds(o2.impliedOdds)}`, `outcome:${o2.id}:${sport}:${league}:${page}`)
      .row();
  }

  if (mainSpread && mainSpread.outcomes.length >= 2) {
    text += '\n\n<b>Spread</b>';
    const [o1, o2] = mainSpread.outcomes;
    kb.text(`⭐ ${esc(o1.label)}  ${fmtOdds(o1.impliedOdds)}`, `outcome:${o1.id}:${sport}:${league}:${page}`)
      .text(`⭐ ${esc(o2.label)}  ${fmtOdds(o2.impliedOdds)}`, `outcome:${o2.id}:${sport}:${league}:${page}`)
      .row();
  }

  if (mainTotal && mainTotal.outcomes.length >= 2) {
    text += '\n\n<b>Total</b>';
    const [o1, o2] = mainTotal.outcomes;
    kb.text(`⭐ ${esc(o1.label)}  ${fmtOdds(o1.impliedOdds)}`, `outcome:${o1.id}:${sport}:${league}:${page}`)
      .text(`⭐ ${esc(o2.label)}  ${fmtOdds(o2.impliedOdds)}`, `outcome:${o2.id}:${sport}:${league}:${page}`)
      .row();
  }

  kb.text('More Spread Lines', `gamespread:${sfx}`)
    .text('More Total Lines', `gametotal:${sfx}`)
    .row()
    .text('↩ Back', backData)
    .text('↩ Menu', 'menu');

  return { text, reply_markup: kb };
}

export async function buildSpreadLinesScreen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  return buildAltLinesScreen(marketId, sport, league, page, 'spread', 'Spread Lines');
}

export async function buildTotalLinesScreen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  return buildAltLinesScreen(marketId, sport, league, page, 'total', 'Total Lines');
}

async function buildAltLinesScreen(
  marketId: string,
  sport: string,
  league: string,
  page: number,
  betType: 'spread' | 'total',
  title: string,
): Promise<{ text: string; reply_markup: InlineKeyboard }> {
  const group = await findGroup(marketId);
  if (!group) return notAvailable();

  const sfx = suffix(marketId, sport, league, page);
  const backData = `gamegl:${sfx}`;
  const dt = fmtDate(group.startTime);
  const header = `<b>${esc(group.name)} — ${title}</b>\n${headerLine(group, dt)}`;

  const lines: OverlaidMarket[] = group.markets
    .filter((m) => m.betType === betType)
    .slice()
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

  type MergedOutcome = { id: string; label: string; impliedOdds: number; liquidityDepth: number };
  type MergedLine = { line: number | null; mainLine: boolean; outcomes: MergedOutcome[] };

  const mergedByLine = new Map<number | null, MergedLine>();
  for (const m of lines) {
    if (!mergedByLine.has(m.line)) {
      mergedByLine.set(m.line, { line: m.line, mainLine: m.mainLine, outcomes: [] });
    }
    const merged = mergedByLine.get(m.line)!;
    if (m.mainLine) merged.mainLine = true;
    for (const o of m.outcomes) {
      const existing = merged.outcomes.find((x) => x.label === o.label);
      const candidate: MergedOutcome = {
        id: o.id,
        label: o.label,
        impliedOdds: o.impliedOdds,
        liquidityDepth: o.availableSize,
      };
      if (!existing) {
        merged.outcomes.push(candidate);
      } else if (candidate.liquidityDepth > existing.liquidityDepth) {
        Object.assign(existing, candidate);
      }
    }
  }

  const dedupedLines = Array.from(mergedByLine.values())
    .filter((m) => m.outcomes.some((o) => o.liquidityDepth > 0) && m.outcomes.length >= 2)
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

  if (dedupedLines.length === 0) {
    const kb = new InlineKeyboard().text('↩ Back', backData).text('↩ Menu', 'menu');
    return { text: header + '\n\nNo alt lines available.', reply_markup: kb };
  }

  const kb = new InlineKeyboard();
  for (const m of dedupedLines) {
    const star = m.mainLine ? '⭐ ' : '';
    const [o1, o2] = m.outcomes;
    kb.text(`${star}${esc(o1.label)}  ${fmtOdds(o1.impliedOdds)}`, `outcome:${o1.id}:${sport}:${league}:${page}`)
      .text(`${star}${esc(o2.label)}  ${fmtOdds(o2.impliedOdds)}`, `outcome:${o2.id}:${sport}:${league}:${page}`)
      .row();
  }

  kb.text('↩ Back', backData).text('↩ Menu', 'menu');
  return { text: header, reply_markup: kb };
}

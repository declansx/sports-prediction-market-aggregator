/**
 * Ad-hoc verification for the DB-free public market builder.
 * Run: `npx tsx src/public/verify.ts` from the bot/ directory.
 *
 * Proves the in-memory grouping reproduces what the DB pipeline produced:
 *  - markets group into events, with SX + Poly landing in the same event
 *  - outcomes align across platforms by canonicalKey (so odds are comparable)
 *  - canonicalization coverage is high (few null keys)
 */
import { fetchPublicMarkets } from './fetchMarkets';

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

async function main() {
  const t0 = Date.now();
  const markets = await fetchPublicMarkets();
  const elapsed = Date.now() - t0;

  const sx = markets.filter((m) => m.platform === 'sx');
  const poly = markets.filter((m) => m.platform === 'polymarket');

  // Group by eventId to inspect cross-platform matching.
  const byEvent = new Map<string, typeof markets>();
  for (const m of markets) {
    if (!byEvent.has(m.eventId)) byEvent.set(m.eventId, []);
    byEvent.get(m.eventId)!.push(m);
  }
  const crossPlatform = [...byEvent.values()].filter(
    (ms) => ms.some((m) => m.platform === 'sx') && ms.some((m) => m.platform === 'polymarket'),
  );

  // Canonicalization coverage.
  let totalOutcomes = 0;
  let nullKeys = 0;
  const nullByType = new Map<string, number>();
  for (const m of markets) {
    for (const o of m.outcomes) {
      totalOutcomes++;
      if (o.canonicalKey === null) {
        nullKeys++;
        const k = `${m.platform}/${m.betType}`;
        nullByType.set(k, (nullByType.get(k) ?? 0) + 1);
      }
    }
  }

  console.log('\n=== Public market builder verification ===');
  console.log(`fetch + build: ${elapsed}ms`);
  console.log(`markets: ${markets.length}  (sx ${sx.length}, poly ${poly.length})`);
  console.log(`events: ${byEvent.size}  cross-platform: ${crossPlatform.length}`);
  console.log(`canonicalize: ${totalOutcomes - nullKeys}/${totalOutcomes} keyed (${pct(totalOutcomes - nullKeys, totalOutcomes)}), ${nullKeys} null`);
  if (nullByType.size) {
    console.log('  null-key breakdown:', Object.fromEntries([...nullByType.entries()].sort()));
  }

  // Sample cross-platform events: show odds aligned by canonicalKey.
  console.log('\n=== Sample cross-platform events (SX vs Poly best odds by canonical key) ===');
  for (const ms of crossPlatform.slice(0, 6)) {
    const ev = ms[0];
    console.log(`\n${ev.league}  ${ev.name}  @ ${ev.startTime}`);
    // Collect best odds per canonicalKey per platform.
    const rows = new Map<string, { sx?: number; poly?: number; label: string }>();
    for (const m of ms) {
      for (const o of m.outcomes) {
        if (!o.canonicalKey) continue;
        const r = rows.get(o.canonicalKey) ?? { label: o.label };
        if (m.platform === 'sx') r.sx = Math.max(r.sx ?? 0, o.impliedOdds);
        else r.poly = Math.max(r.poly ?? 0, o.impliedOdds);
        rows.set(o.canonicalKey, r);
      }
    }
    for (const [key, r] of [...rows.entries()].sort()) {
      const both = r.sx !== undefined && r.poly !== undefined ? '  <-- both' : '';
      console.log(
        `  ${key.padEnd(20)} sx=${r.sx !== undefined ? r.sx.toFixed(4) : '   -  '}  poly=${r.poly !== undefined ? r.poly.toFixed(4) : '   -  '}${both}`,
      );
    }
  }
  console.log('');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

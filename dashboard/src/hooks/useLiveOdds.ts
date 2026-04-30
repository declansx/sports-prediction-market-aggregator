import { useState, useEffect } from 'react';
import { wsBus } from '../lib/wsBus';

// Maps "${marketHash}:${isMakerBettingOutcomeOne}" → takerOdds
// SX outcome externalId format: "${marketHash}:0" (taker bets outcomeOne → maker bets outcomeTwo → isMaker=false)
//                                 "${marketHash}:1" (taker bets outcomeTwo → maker bets outcomeOne → isMaker=true)
export type LiveOddsMap = Map<string, number>;

export function useLiveOdds(): LiveOddsMap {
  const [oddsMap, setOddsMap] = useState<LiveOddsMap>(new Map());

  useEffect(() => {
    const off = wsBus.onOdds((msg) => {
      if (msg.type === 'snapshot') {
        const map = new Map<string, number>();
        for (const e of msg.data) {
          map.set(`${e.marketHash}:${e.isMakerBettingOutcomeOne}`, e.takerOdds);
        }
        setOddsMap(map);
      } else {
        const e = msg.data;
        if (e.marketHash === '0xc846423fee394c7b17508d3b253e1d681fddcf5666007f2d99e6bf470c5414b0') {
          console.log('[DIAG useLiveOdds] received update', { isMakerOne: e.isMakerBettingOutcomeOne, takerOdds: e.takerOdds, key: `${e.marketHash}:${e.isMakerBettingOutcomeOne}` });
        }
        setOddsMap((prev) => {
          const next = new Map(prev);
          next.set(`${e.marketHash}:${e.isMakerBettingOutcomeOne}`, e.takerOdds);
          return next;
        });
      }
    });
    return off;
  }, []);

  return oddsMap;
}

// Converts an SX Bet outcome externalId (e.g. "0xabc:0") to the live odds map key
export function liveOddsKey(externalId: string): string {
  const colonIdx = externalId.lastIndexOf(':');
  if (colonIdx === -1) return '';
  const hash = externalId.slice(0, colonIdx);
  const side = externalId.slice(colonIdx + 1);
  // side "0" = takerBetsOutcomeOne → isMakerBettingOutcomeOne = false
  // side "1" = takerBetsOutcomeTwo → isMakerBettingOutcomeOne = true
  return `${hash}:${side === '1'}`;
}

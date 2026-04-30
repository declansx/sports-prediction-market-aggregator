import { useEffect, useState } from 'react';
import { wsBus, type BookLevel } from '../lib/wsBus';

export interface OrderBookSides {
  outcomeOne: BookLevel[];
  outcomeTwo: BookLevel[];
}

// Subscribes to the SX book for a given marketHash. Returns null while waiting for first frame.
export function useOrderBook(marketHash: string | null): OrderBookSides | null {
  const [book, setBook] = useState<OrderBookSides | null>(null);

  useEffect(() => {
    if (!marketHash) {
      setBook(null);
      return;
    }
    setBook(null);
    const offFrames = wsBus.onBook((frame) => {
      if (frame.marketHash !== marketHash) return;
      setBook({ outcomeOne: frame.outcomeOne, outcomeTwo: frame.outcomeTwo });
    });
    wsBus.subscribeBook(marketHash);
    return () => {
      offFrames();
      wsBus.unsubscribeBook(marketHash);
    };
  }, [marketHash]);

  return book;
}

// Subscribes to the Polymarket book for a given tokenId. Returns null while waiting for first frame.
export function usePolyOrderBook(tokenId: string | null): BookLevel[] | null {
  const [levels, setLevels] = useState<BookLevel[] | null>(null);

  useEffect(() => {
    if (!tokenId) {
      setLevels(null);
      return;
    }
    setLevels(null);
    const off = wsBus.onPolyBook((frame) => {
      if (frame.tokenId !== tokenId) return;
      setLevels(frame.levels);
    });
    wsBus.subscribePolyBook(tokenId);
    return () => {
      off();
      wsBus.unsubscribePolyBook(tokenId);
    };
  }, [tokenId]);

  return levels;
}

// Extract marketHash + side from an SX outcome externalId "${hash}:0|1".
// Returns null for non-SX outcome ids.
export function parseSxExternalId(externalId: string | undefined | null): { marketHash: string; side: 0 | 1 } | null {
  if (!externalId) return null;
  const idx = externalId.lastIndexOf(':');
  if (idx === -1) return null;
  const suffix = externalId.slice(idx + 1);
  if (suffix !== '0' && suffix !== '1') return null;
  return { marketHash: externalId.slice(0, idx), side: suffix === '0' ? 0 : 1 };
}

// Shared WebSocket bus — single connection per dashboard tab.
// Both useLiveOdds and useOrderBook consume from it.

import type { Market } from './api';

export type MarketLifecycleMessage =
  | { type: 'marketsSnapshot'; data: Market[] }
  | { type: 'marketUpsert'; data: Market }
  | { type: 'marketRemoved'; id: string };

export interface BestOddsEntry {
  marketHash: string;
  isMakerBettingOutcomeOne: boolean;
  takerOdds: number;
  updatedAt: number;
}

export interface BookLevel {
  odds: number;
  size: number;
}

export interface BookFrame {
  marketHash: string;
  outcomeOne: BookLevel[];
  outcomeTwo: BookLevel[];
}

export interface PolyBookFrame {
  tokenId: string;
  levels: BookLevel[];
}

export interface PolyOddsEntry {
  tokenId: string;
  takerOdds: number;
  updatedAt: number;
}

export type PolyOddsMessage =
  | { type: 'polyOddsSnapshot'; data: PolyOddsEntry[] }
  | { type: 'polyOddsUpdate'; tokenId: string; takerOdds: number; updatedAt: number };

export interface FixturePeriod {
  label: string;
  isFinished: boolean;
  teamOneScore: string;
  teamTwoScore: string;
}

export interface FixtureState {
  sxEventId: string;
  status: number;
  teamOneScore: number;
  teamTwoScore: number;
  currentPeriod: string;
  periodTime: string;
  periods: FixturePeriod[];
  updatedAt: number;
}

export type FixtureMessage =
  | { type: 'fixtureSnapshot'; data: FixtureState[] }
  | { type: 'fixtureUpdate'; data: FixtureState }
  | { type: 'fixtureRemove'; sxEventId: string };

type IncomingMessage =
  | { type: 'snapshot'; data: BestOddsEntry[] }
  | { type: 'update'; data: BestOddsEntry }
  | { type: 'bookSnapshot'; marketHash: string; outcomeOne: BookLevel[]; outcomeTwo: BookLevel[] }
  | { type: 'bookUpdate'; marketHash: string; outcomeOne: BookLevel[]; outcomeTwo: BookLevel[] }
  | { type: 'polyBookSnapshot'; tokenId: string; levels: BookLevel[] }
  | { type: 'polyBookUpdate'; tokenId: string; levels: BookLevel[] }
  | { type: 'polyOddsSnapshot'; data: PolyOddsEntry[] }
  | { type: 'polyOddsUpdate'; tokenId: string; takerOdds: number; updatedAt: number }
  | FixtureMessage
  | MarketLifecycleMessage;

type OddsListener = (msg: { type: 'snapshot'; data: BestOddsEntry[] } | { type: 'update'; data: BestOddsEntry }) => void;
type BookListener = (frame: BookFrame) => void;
type PolyBookListener = (frame: PolyBookFrame) => void;
type PolyOddsListener = (msg: PolyOddsMessage) => void;
type FixtureListener = (msg: FixtureMessage) => void;
type MarketLifecycleListener = (msg: MarketLifecycleMessage) => void;
type StatusListener = (connected: boolean) => void;

const WS_URL = (() => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base) return base.replace(/^http/, 'ws') + '/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
})();

// Public (read-only) build is served statically with no bot behind it, so the
// real-time relay doesn't exist. In that mode the bus stays dormant and the
// dashboard refreshes via REST polling instead.
const PUBLIC_MODE = import.meta.env.VITE_PUBLIC_MODE === 'true';

class WsBus {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private oddsListeners = new Set<OddsListener>();
  private bookListeners = new Set<BookListener>();
  private polyBookListeners = new Set<PolyBookListener>();
  private polyOddsListeners = new Set<PolyOddsListener>();
  private fixtureListeners = new Set<FixtureListener>();
  private marketLifecycleListeners = new Set<MarketLifecycleListener>();
  private statusListeners = new Set<StatusListener>();
  // Retained so new listeners get the current fixture state on subscribe.
  private fixtureCache = new Map<string, FixtureState>();
  // Mirror of the bot's market list. Populated by `marketsSnapshot` on WS
  // connect, then patched by `marketUpsert` / `marketRemoved`. Replayed to
  // late subscribers so a remounting page sees the current state without
  // waiting for a fresh snapshot.
  private marketsCache = new Map<string, Market>();
  private marketsSnapshotReceived = false;
  // ref-counted per-marketHash book subscriptions (from this browser)
  private bookSubRefs = new Map<string, number>();
  private polyBookSubRefs = new Map<string, number>();
  private polyOddsSubRefs = new Map<string, number>();

  private connect(): void {
    if (PUBLIC_MODE) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      for (const l of this.statusListeners) l(true);
      // Re-send any active book subs (server lost them on disconnect)
      for (const marketHash of this.bookSubRefs.keys()) {
        this.send({ type: 'subscribeBook', marketHash });
      }
      for (const tokenId of this.polyBookSubRefs.keys()) {
        this.send({ type: 'subscribePolyBook', tokenId });
      }
      const polyOddsTokens = Array.from(this.polyOddsSubRefs.keys());
      if (polyOddsTokens.length > 0) {
        this.send({ type: 'subscribePolyOdds', tokenIds: polyOddsTokens });
      }
    };

    ws.onmessage = (event) => {
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(event.data as string) as IncomingMessage;
      } catch {
        return;
      }
      if (msg.type === 'snapshot' || msg.type === 'update') {
        for (const l of this.oddsListeners) l(msg);
      } else if (msg.type === 'bookSnapshot' || msg.type === 'bookUpdate') {
        const frame: BookFrame = {
          marketHash: msg.marketHash,
          outcomeOne: msg.outcomeOne,
          outcomeTwo: msg.outcomeTwo,
        };
        for (const l of this.bookListeners) l(frame);
      } else if (msg.type === 'polyBookSnapshot' || msg.type === 'polyBookUpdate') {
        const frame: PolyBookFrame = { tokenId: msg.tokenId, levels: msg.levels };
        for (const l of this.polyBookListeners) l(frame);
      } else if (msg.type === 'polyOddsSnapshot' || msg.type === 'polyOddsUpdate') {
        for (const l of this.polyOddsListeners) l(msg);
      } else if (msg.type === 'fixtureSnapshot') {
        this.fixtureCache.clear();
        for (const s of msg.data) this.fixtureCache.set(s.sxEventId, s);
        for (const l of this.fixtureListeners) l(msg);
      } else if (msg.type === 'fixtureUpdate') {
        const prev = this.fixtureCache.get(msg.data.sxEventId);
        if (prev && prev.updatedAt >= msg.data.updatedAt) return;
        this.fixtureCache.set(msg.data.sxEventId, msg.data);
        for (const l of this.fixtureListeners) l(msg);
      } else if (msg.type === 'fixtureRemove') {
        this.fixtureCache.delete(msg.sxEventId);
        for (const l of this.fixtureListeners) l(msg);
      } else if (msg.type === 'marketsSnapshot') {
        this.marketsCache.clear();
        for (const m of msg.data) this.marketsCache.set(m.id, m);
        this.marketsSnapshotReceived = true;
        for (const l of this.marketLifecycleListeners) l(msg);
      } else if (msg.type === 'marketUpsert') {
        this.marketsCache.set(msg.data.id, msg.data);
        for (const l of this.marketLifecycleListeners) l(msg);
      } else if (msg.type === 'marketRemoved') {
        this.marketsCache.delete(msg.id);
        for (const l of this.marketLifecycleListeners) l(msg);
      }
    };

    ws.onerror = () => {
      for (const l of this.statusListeners) l(false);
    };

    ws.onclose = () => {
      this.ws = null;
      for (const l of this.statusListeners) l(false);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 3_000);
    };
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        // ignore; reconnect handler replays
      }
    }
  }

  private ensureConnected(): void {
    // Public read-only dashboard has no bot/relay to connect to — it polls
    // GET /api/markets instead (see useMarketList). Skip the socket entirely
    // so we don't spin a doomed 3s reconnect loop against a dead endpoint.
    if (PUBLIC_MODE) return;
    if (!this.ws) this.connect();
  }

  onOdds(listener: OddsListener): () => void {
    this.ensureConnected();
    this.oddsListeners.add(listener);
    return () => { this.oddsListeners.delete(listener); };
  }

  onBook(listener: BookListener): () => void {
    this.ensureConnected();
    this.bookListeners.add(listener);
    return () => { this.bookListeners.delete(listener); };
  }

  onFixture(listener: FixtureListener): () => void {
    this.ensureConnected();
    this.fixtureListeners.add(listener);
    // Replay current cached snapshot so a late-subscribing component gets initial state
    if (this.fixtureCache.size > 0) {
      listener({ type: 'fixtureSnapshot', data: Array.from(this.fixtureCache.values()) });
    }
    return () => { this.fixtureListeners.delete(listener); };
  }

  onMarketLifecycle(listener: MarketLifecycleListener): () => void {
    this.ensureConnected();
    this.marketLifecycleListeners.add(listener);
    // Replay the cached snapshot so a late-subscribing component (e.g. after
    // a route change) gets the full market list without waiting for a fresh
    // WS reconnect. Only replay if we've actually received a snapshot — an
    // empty cache before first connect would mislead the consumer into
    // thinking there are zero markets.
    if (this.marketsSnapshotReceived) {
      listener({ type: 'marketsSnapshot', data: Array.from(this.marketsCache.values()) });
    }
    return () => { this.marketLifecycleListeners.delete(listener); };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.ws?.readyState === WebSocket.OPEN);
    return () => { this.statusListeners.delete(listener); };
  }

  subscribeBook(marketHash: string): void {
    this.ensureConnected();
    const current = this.bookSubRefs.get(marketHash) ?? 0;
    this.bookSubRefs.set(marketHash, current + 1);
    if (current === 0) this.send({ type: 'subscribeBook', marketHash });
  }

  unsubscribeBook(marketHash: string): void {
    const current = this.bookSubRefs.get(marketHash) ?? 0;
    if (current <= 1) {
      this.bookSubRefs.delete(marketHash);
      this.send({ type: 'unsubscribeBook', marketHash });
    } else {
      this.bookSubRefs.set(marketHash, current - 1);
    }
  }

  onPolyBook(listener: PolyBookListener): () => void {
    this.ensureConnected();
    this.polyBookListeners.add(listener);
    return () => { this.polyBookListeners.delete(listener); };
  }

  subscribePolyBook(tokenId: string): void {
    this.ensureConnected();
    const current = this.polyBookSubRefs.get(tokenId) ?? 0;
    this.polyBookSubRefs.set(tokenId, current + 1);
    if (current === 0) this.send({ type: 'subscribePolyBook', tokenId });
  }

  unsubscribePolyBook(tokenId: string): void {
    const current = this.polyBookSubRefs.get(tokenId) ?? 0;
    if (current <= 1) {
      this.polyBookSubRefs.delete(tokenId);
      this.send({ type: 'unsubscribePolyBook', tokenId });
    } else {
      this.polyBookSubRefs.set(tokenId, current - 1);
    }
  }

  onPolyOdds(listener: PolyOddsListener): () => void {
    this.ensureConnected();
    this.polyOddsListeners.add(listener);
    return () => { this.polyOddsListeners.delete(listener); };
  }

  subscribePolyOdds(tokenIds: string[]): void {
    if (tokenIds.length === 0) return;
    this.ensureConnected();
    const fresh: string[] = [];
    for (const id of tokenIds) {
      const current = this.polyOddsSubRefs.get(id) ?? 0;
      this.polyOddsSubRefs.set(id, current + 1);
      if (current === 0) fresh.push(id);
    }
    if (fresh.length > 0) this.send({ type: 'subscribePolyOdds', tokenIds: fresh });
  }

  unsubscribePolyOdds(tokenIds: string[]): void {
    if (tokenIds.length === 0) return;
    const drop: string[] = [];
    for (const id of tokenIds) {
      const current = this.polyOddsSubRefs.get(id) ?? 0;
      if (current <= 1) {
        this.polyOddsSubRefs.delete(id);
        drop.push(id);
      } else {
        this.polyOddsSubRefs.set(id, current - 1);
      }
    }
    if (drop.length > 0) this.send({ type: 'unsubscribePolyOdds', tokenIds: drop });
  }
}

export const wsBus = new WsBus();

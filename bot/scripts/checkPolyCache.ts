/**
 * Quick check: open a WS connection to the bot's relay, subscribe to a tokenId,
 * and print whatever polyOddsSnapshot comes back. Useful for diagnosing
 * whether the cache value matches the API value.
 */
import WebSocket from 'ws';

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('Usage: checkPolyCache <tokenId>');
  process.exit(1);
}

const ws = new WebSocket('ws://localhost:3007/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribePolyOdds', tokenIds: [TOKEN] }));
});
ws.on('message', (raw) => {
  const txt = raw.toString();
  try {
    const msg = JSON.parse(txt);
    if (msg.type === 'polyOddsSnapshot' || msg.type === 'polyOddsUpdate') {
      console.log(JSON.stringify(msg, null, 2));
    }
  } catch {
    // ignore
  }
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 3000);

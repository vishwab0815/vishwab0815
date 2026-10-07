import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkEndpoint, runChecks, summarizeEndpoints } from '../monitor.mjs';

const DAY = 86400e3;
const NOW = Date.parse('2026-10-07T12:00:00Z');
const EPS = [{ name: 'A', url: 'https://a.example/' }, { name: 'B', url: 'https://b.example/' }];

test('follows redirects and carries cookies across them', async (t) => {
  // /start sets a cookie and redirects; /app only answers 200 if the cookie came along.
  const server = createServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(303, { Location: '/app', 'Set-Cookie': 'session=abc; Path=/; HttpOnly' });
      return res.end();
    }
    if (req.url === '/app') {
      res.writeHead(req.headers.cookie === 'session=abc' ? 200 : 303, req.headers.cookie ? {} : { Location: '/start' });
      return res.end('ok');
    }
    res.writeHead(500).end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const ok = await checkEndpoint(`${base}/app`);
  assert.equal(ok.ok, true);
  assert.equal(ok.code, 200);

  const broken = await checkEndpoint(`${base}/nope`, 1);
  assert.deepEqual([broken.ok, broken.code], [false, 500]);
});

test('cookies stay on their own host and Max-Age=0 deletes them', async (t) => {
  // 127.0.0.1 sets a cookie then bounces to localhost, which must not receive it (the Streamlit bug).
  const server = createServer((req, res) => {
    const port = server.address().port;
    if (req.url === '/start') {
      res.writeHead(303, { Location: `http://localhost:${port}/check`, 'Set-Cookie': 'leak=1; Path=/' });
      return res.end();
    }
    if (req.url === '/check') return res.writeHead(req.headers.cookie ? 500 : 200).end();
    if (req.url === '/clear') {
      res.writeHead(303, { Location: '/after', 'Set-Cookie': ['a=1; Path=/', 'a=; Max-Age=0; Path=/'] });
      return res.end();
    }
    if (req.url === '/after') return res.writeHead(req.headers.cookie ? 500 : 200).end();
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const port = server.address().port;

  assert.equal((await checkEndpoint(`http://127.0.0.1:${port}/start`, 1)).code, 200);
  assert.equal((await checkEndpoint(`http://127.0.0.1:${port}/clear`, 1)).code, 200);
});

test('unreachable hosts fail cleanly', async () => {
  const r = await checkEndpoint('http://127.0.0.1:9/', 1);
  assert.equal(r.ok, false);
  assert.equal(typeof r.code, 'string');
});

test('outages open one incident and resolve on recovery', async () => {
  const state = {};
  const fake = (down) => async (url) => (url.includes(down) ? { ok: false, code: 503, ms: 100 } : { ok: true, code: 200, ms: 120 });

  await runChecks(state, EPS, NOW, fake('b.example'));
  await runChecks(state, EPS, NOW + 3600e3, fake('b.example'));
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].title, 'B is unreachable');
  assert.equal(state.incidents[0].detail, 'Check failed: HTTP 503');
  assert.equal(state.incidents[0].severity, 'major');

  await runChecks(state, EPS, NOW + 7200e3, fake('nothing'));
  assert.ok(state.incidents[0].resolvedAt);
  assert.equal(state.checks.A.length, 3);
  assert.equal(state.monitoringSince, new Date(NOW).toISOString());
});

test('samples older than 90 days are dropped and days bucket correctly', async () => {
  const state = { checks: { A: [[(NOW - 100 * DAY) / 1000, 1, 50]], B: [] } };
  const ok = async () => ({ ok: true, code: 200, ms: 200 });
  await runChecks(state, EPS, NOW, ok);
  assert.equal(state.checks.A.length, 1);

  state.checks.B = [[(NOW - DAY) / 1000, 0, 1], [(NOW - DAY) / 1000 + 60, 1, 300], [NOW / 1000, 1, 100]];
  const [a, b] = summarizeEndpoints(state, EPS, NOW);
  assert.equal(a.days.length, 90);
  assert.equal(a.days.at(-1), 1);
  assert.equal(a.days.at(-2), null);
  assert.equal(b.days.at(-2), 0.5);
  assert.equal(b.days.at(-1), 1);
  assert.equal(Math.round(b.uptime), 67);
  assert.equal(b.avgMs, 200);
  assert.equal(b.up, true);
  assert.equal(b.host, 'b.example');
});

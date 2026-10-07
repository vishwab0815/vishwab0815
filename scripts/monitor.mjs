// Uptime checks for the live demos. Samples live in state.checks as [unixSeconds, ok, ms].

import { openIncident, resolveIncident } from './lib/incidents.mjs';

export const ENDPOINTS = [
  { name: 'Portfolio', url: 'https://vishwa-b.vercel.app/' },
  { name: 'CTF-CyberPunk', url: 'https://ctfcybersec.vercel.app/' },
  { name: 'BotTrainer', url: 'https://llm-trainer.streamlit.app/' },
  { name: 'TaskFlow', url: 'https://task-flow-slots.vercel.app/' },
  { name: 'Quick-Bite', url: 'https://quick-bite-bbgx.onrender.com/' },
];

const DAY = 86400e3;
export const WINDOW_DAYS = 90;
const TIMEOUT = 45e3; // free tiers (Render, Streamlit) cold-start slowly
const MAX_REDIRECTS = 8;

// Just enough of a cookie jar for auth redirects: host-only vs Domain= scoping, and Max-Age=0 deletes.
function cookieJar() {
  const cookies = new Map(); // `${domain}|${name}` → { domain, hostOnly, name, value }
  return {
    store(host, header) {
      const [pair, ...attrs] = header.split(';').map((s) => s.trim());
      const i = pair.indexOf('=');
      if (i <= 0) return;
      const attr = (n) => attrs.find((a) => a.toLowerCase().startsWith(`${n}=`))?.slice(n.length + 1);
      const domain = attr('domain')?.replace(/^\./, '').toLowerCase();
      const c = { domain: domain ?? host, hostOnly: !domain, name: pair.slice(0, i), value: pair.slice(i + 1) };
      const key = `${c.domain}|${c.name}`;
      if (attr('max-age') !== undefined && Number(attr('max-age')) <= 0) cookies.delete(key);
      else cookies.set(key, c);
    },
    header(host) {
      return [...cookies.values()]
        .filter((c) => (c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`)))
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
    },
  };
}

// One GET that follows redirects by hand so cookies survive them (Streamlit's auth hop needs that).
async function getOnce(url) {
  const started = Date.now();
  const jar = cookieJar();
  const signal = AbortSignal.timeout(TIMEOUT);
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const host = new URL(target).hostname;
    const cookie = jar.header(host);
    const res = await fetch(target, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; vishwab0815-status/1.0; +https://github.com/vishwab0815)',
        Accept: 'text/html,*/*',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    for (const c of res.headers.getSetCookie?.() ?? []) jar.store(host, c);
    const location = res.headers.get('location');
    await res.body?.cancel();
    if (res.status >= 300 && res.status < 400 && location) {
      target = new URL(location, target).href;
      continue;
    }
    return { ok: res.status < 400, code: res.status, ms: Date.now() - started };
  }
  return { ok: false, code: 'too many redirects', ms: Date.now() - started };
}

export async function checkEndpoint(url, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await getOnce(url);
    } catch (err) {
      last = { ok: false, code: err.name === 'TimeoutError' ? 'timeout' : err.cause?.code ?? err.message, ms: TIMEOUT };
    }
    if (last.ok) return last;
  }
  return last;
}

export async function runChecks(state, endpoints, now, check = checkEndpoint) {
  const results = await Promise.all(endpoints.map(async (e) => ({ ...e, ...(await check(e.url)) })));
  state.checks ??= {};
  state.monitoringSince ??= new Date(now).toISOString();
  const cutoff = (now - WINDOW_DAYS * DAY) / 1000;
  for (const r of results) {
    const samples = (state.checks[r.name] ?? []).filter(([t]) => t >= cutoff);
    samples.push([Math.round(now / 1000), r.ok ? 1 : 0, r.ms]);
    state.checks[r.name] = samples;

    const key = `endpoint:${r.name}`;
    if (r.ok) resolveIncident(state, key, now, 'Recovered; checks passing again');
    else openIncident(state, {
      key, severity: 'major',
      title: `${r.name} is unreachable`,
      detail: r.code === 'timeout' ? `No response within ${TIMEOUT / 1000}s` : `Check failed: ${typeof r.code === 'number' ? `HTTP ${r.code}` : r.code}`,
    }, now);
  }
  return results;
}

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Per-endpoint view for the status card: 90 daily buckets (oldest → today), uptime and latency.
export function summarizeEndpoints(state, endpoints, now) {
  return endpoints.map(({ name, url }) => {
    const samples = state.checks?.[name] ?? [];
    const byDay = new Map();
    for (const [t, ok] of samples) {
      const d = utcDay(t * 1000);
      const b = byDay.get(d) ?? { ok: 0, n: 0 };
      b.ok += ok;
      b.n += 1;
      byDay.set(d, b);
    }
    const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
      const b = byDay.get(utcDay(now - (WINDOW_DAYS - 1 - i) * DAY));
      return b ? b.ok / b.n : null;
    });
    const okSamples = samples.filter(([, ok]) => ok);
    const recentOk = okSamples.filter(([t]) => t * 1000 >= now - 7 * DAY);
    return {
      name,
      host: new URL(url).host,
      days,
      uptime: samples.length ? (okSamples.length / samples.length) * 100 : null,
      avgMs: recentOk.length ? Math.round(recentOk.reduce((s, [, , ms]) => s + ms, 0) / recentOk.length) : null,
      up: samples.length ? samples.at(-1)[1] === 1 : null,
    };
  });
}

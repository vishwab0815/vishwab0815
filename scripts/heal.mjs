// Self-healing README: every third-party image is probed. A broken one is swapped for its alt text
// (wrapped in <!--heal:id--> markers), the original is kept in .github/heal-store.json, and it is put
// back as soon as the service answers again. Each outage becomes an incident in the public log.

import { createHash } from 'node:crypto';
import { openIncident, resolveIncident, openIncidents } from './lib/incidents.mjs';

const HTML_IMG = /<img\b[^>]*?\bsrc="(https?:\/\/[^"]+)"[^>]*>/gi;
const MD_IMG = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const ALT = /\balt="([^"]*)"/i;

const marker = (id) => new RegExp(`<!--heal:${id}-->[\\s\\S]*?<!--/heal:${id}-->`, 'g');
const escHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const hostOf = (url) => new URL(url).host;

export function findImages(readme, isOwn = () => false) {
  const found = [];
  for (const m of readme.matchAll(HTML_IMG)) found.push({ tag: m[0], url: m[1], alt: m[0].match(ALT)?.[1] ?? '' });
  for (const m of readme.matchAll(MD_IMG)) found.push({ tag: m[0], url: m[2], alt: m[1] });
  return found.filter((i) => !isOwn(i.url));
}

export async function probeImage(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15e3), headers: { 'User-Agent': 'vishwab0815-heal/1.0' } });
      const type = res.headers.get('content-type') ?? '';
      await res.body?.cancel();
      if (res.ok && type.startsWith('image/')) return true;
    } catch {
      // network error or timeout: retry
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return false;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

export async function heal(readme, store, { probe = probeImage, isOwn, now }) {
  store = { ...store };
  const cache = new Map();
  const probeOnce = (url) => {
    if (!cache.has(url)) cache.set(url, probe(url));
    return cache.get(url);
  };
  const restored = [], degraded = [];

  // 1. Put back anything whose service has recovered. Drop entries the owner edited out of the README.
  for (const [id, entry] of Object.entries(store)) {
    if (!marker(id).test(readme)) {
      delete store[id];
      continue;
    }
    if (await probeOnce(entry.url)) {
      readme = readme.replace(marker(id), () => entry.original);
      delete store[id];
      restored.push(entry.url);
    }
  }

  // 2. Probe every live third-party image; swap the broken ones for text.
  const images = findImages(readme, isOwn);
  const urls = [...new Set(images.map((i) => i.url))];
  const healthy = await mapLimit(urls, 6, probeOnce);
  const broken = new Set(urls.filter((_, i) => !healthy[i]));
  const seen = new Set();
  for (const img of images) {
    if (!broken.has(img.url) || seen.has(img.tag)) continue;
    seen.add(img.tag);
    const id = createHash('sha1').update(img.tag).digest('hex').slice(0, 8);
    const fallback = img.alt ? `<code>${escHtml(img.alt)}</code>` : '';
    readme = readme.split(img.tag).join(`<!--heal:${id}-->${fallback}<!--/heal:${id}-->`);
    store[id] = { url: img.url, original: img.tag, since: new Date(now).toISOString() };
    degraded.push(img.url);
  }

  const monitored = new Set([...urls, ...Object.values(store).map((e) => e.url)]).size;
  return { readme, store, restored, degraded, monitored };
}

// One incident per host: opened when its images get swapped out, resolved once none remain swapped.
export function recordHealIncidents(state, { store, degraded }, now) {
  const swappedByHost = new Map();
  for (const entry of Object.values(store)) {
    const host = hostOf(entry.url);
    swappedByHost.set(host, (swappedByHost.get(host) ?? 0) + 1);
  }
  for (const host of new Set(degraded.map(hostOf))) {
    const n = swappedByHost.get(host) ?? 0;
    openIncident(state, {
      key: `widget:${host}`, severity: 'minor', auto: true,
      title: `${host} stopped serving images`,
      detail: `${n} image${n === 1 ? '' : 's'} swapped for text fallbacks automatically`,
    }, now);
  }
  for (const inc of openIncidents(state, 'widget:')) {
    const host = inc.key.slice('widget:'.length);
    if (!swappedByHost.has(host)) resolveIncident(state, inc.key, now, 'Service back; original images restored automatically');
  }
}

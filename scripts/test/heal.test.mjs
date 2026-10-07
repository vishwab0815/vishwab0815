import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heal, findImages, recordHealIncidents } from '../heal.mjs';

const README = `# Hi
<img src="https://skillicons.dev/icons?i=ts,js" alt="TypeScript, JavaScript" />
<img src="https://img.shields.io/badge/FastAPI-009688" alt="FastAPI" />
<img src="https://img.shields.io/badge/FastAPI-009688" alt="FastAPI" />
[![Portfolio](https://img.shields.io/badge/Portfolio-blue)](https://example.com)
<img src="https://raw.githubusercontent.com/me/me/output/a.svg" alt="own" />
<img src="assets/header.svg" alt="local" />
`;
const isOwn = (u) => u.startsWith('https://raw.githubusercontent.com/me/me/');
const probeWith = (down) => async (url) => !down.some((h) => url.includes(h));

test('finds third-party images only', () => {
  const urls = findImages(README, isOwn).map((i) => i.url);
  assert.deepEqual(urls, [
    'https://skillicons.dev/icons?i=ts,js',
    'https://img.shields.io/badge/FastAPI-009688',
    'https://img.shields.io/badge/FastAPI-009688',
    'https://img.shields.io/badge/Portfolio-blue',
  ]);
});

test('healthy README is left untouched', async () => {
  const r = await heal(README, {}, { probe: probeWith([]), isOwn, now: 0 });
  assert.equal(r.readme, README);
  assert.deepEqual(r.store, {});
  assert.equal(r.monitored, 3);
});

test('broken images degrade to alt text, then restore byte-for-byte', async () => {
  const down = await heal(README, {}, { probe: probeWith(['shields.io']), isOwn, now: 0 });
  assert.equal(down.degraded.length, 2); // two unique shields tags
  assert.match(down.readme, /<!--heal:[0-9a-f]{8}--><code>FastAPI<\/code><!--\/heal:[0-9a-f]{8}-->/);
  assert.equal(down.readme.match(/<code>FastAPI<\/code>/g).length, 2);
  assert.match(down.readme, /\[<!--heal:[0-9a-f]{8}--><code>Portfolio<\/code><!--\/heal:[0-9a-f]{8}-->\]\(https:\/\/example\.com\)/);
  assert.ok(down.readme.includes('skillicons.dev'));
  assert.equal(down.monitored, 3);

  const still = await heal(down.readme, down.store, { probe: probeWith(['shields.io']), isOwn, now: 1 });
  assert.equal(still.readme, down.readme);
  assert.deepEqual(still.store, down.store);

  const back = await heal(down.readme, down.store, { probe: probeWith([]), isOwn, now: 2 });
  assert.equal(back.readme, README);
  assert.deepEqual(back.store, {});
  assert.equal(back.restored.length, 2);
});

test('store entries vanish when the owner edits the placeholder away', async () => {
  const down = await heal(README, {}, { probe: probeWith(['skillicons']), isOwn, now: 0 });
  const edited = down.readme.replace(/<!--heal:[\s\S]*?-->[\s\S]*?<!--\/heal:[0-9a-f]{8}-->/, 'hand-written stack');
  const r = await heal(edited, down.store, { probe: probeWith(['skillicons']), isOwn, now: 1 });
  assert.deepEqual(r.store, {});
  assert.ok(r.readme.includes('hand-written stack'));
});

test('one incident per host, resolved after restore', async () => {
  const state = {};
  const down = await heal(README, {}, { probe: probeWith(['shields.io']), isOwn, now: 0 });
  recordHealIncidents(state, down, 0);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].key, 'widget:img.shields.io');
  assert.equal(state.incidents[0].auto, true);
  assert.match(state.incidents[0].detail, /^2 images swapped/);

  const still = await heal(down.readme, down.store, { probe: probeWith(['shields.io']), isOwn, now: 1 });
  recordHealIncidents(state, still, 1);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].resolvedAt, null);

  const back = await heal(down.readme, down.store, { probe: probeWith([]), isOwn, now: 3600e3 });
  recordHealIncidents(state, back, 3600e3);
  assert.equal(state.incidents[0].resolvedAt, '1970-01-01T01:00:00.000Z');
});

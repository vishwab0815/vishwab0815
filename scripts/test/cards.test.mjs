import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, renderOverview, renderLanguages, renderActivity } from '../cards/stats.mjs';
import { toPods, renderCluster } from '../cards/cluster.mjs';
import { renderStatus } from '../cards/status.mjs';
import { renderIncidents } from '../cards/incidents.mjs';
import { summarizeEndpoints, ENDPOINTS } from '../monitor.mjs';
import { duration, ago } from '../lib/svg.mjs';

const DAY = 86400e3;
const NOW = Date.parse('2026-10-07T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// Minimal well-formedness check: every tag closes in order, no leaked JS values.
function assertSvg(svg) {
  assert.doesNotMatch(svg, /undefined|NaN|\[object /);
  const stripped = svg.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  for (const [, close, name, selfClose] of stripped.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (selfClose) continue;
    if (!close) stack.push(name);
    else assert.equal(stack.pop(), name, `unbalanced </${name}>`);
  }
  assert.deepEqual(stack, []);
}

const repo = (name, extra = {}) => ({
  name, stars: 2, isArchived: false, createdAt: iso(NOW - 200 * DAY), pushedAt: iso(NOW - 2 * DAY),
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, languages: [{ name: 'TypeScript', color: '#3178c6', size: 900 }, { name: 'Rust', color: '#dea584', size: 100 }],
  commitDates: [iso(NOW - DAY), iso(NOW - 10 * DAY), iso(NOW - 20 * DAY)], commits7d: 1, ciState: null, ...extra,
});

const DATA = {
  login: 'vishwab0815', name: 'Vishwanath B', createdAt: '2025-11-09T06:02:40Z', followers: 3, pullRequests: 22,
  publicRepos: 4, commitsThisYear: 300,
  repos: [
    repo('ASTRA'),
    repo('Quick-Bite', { pushedAt: iso(NOW - 300 * DAY), primaryLanguage: null }),
    repo('Broken-CI', { ciState: 'FAILURE' }),
    repo('vishwab0815'),
  ],
  days: Array.from({ length: 400 }, (_, i) => ({ date: iso(NOW - (399 - i) * DAY).slice(0, 10), count: i % 3 })),
};

test('time helpers', () => {
  assert.equal(duration(30e3), '1m');
  assert.equal(duration(47 * 60e3), '47m');
  assert.equal(duration(3600e3), '1h');
  assert.equal(duration(5 * 3600e3 + 12 * 60e3), '5h 12m');
  assert.equal(duration(3 * DAY), '3d');
  assert.equal(ago(iso(NOW - 60e3), NOW), 'just now');
  assert.equal(ago(iso(NOW - 3 * 3600e3), NOW), '3h ago');
});

test('pods map repo health to kubernetes statuses', () => {
  const pods = toPods(DATA.repos, DATA.login, NOW);
  assert.equal(pods.length, 3, 'profile repo is excluded');
  const by = Object.fromEntries(pods.map((p) => [p.name.replace(/-[0-9a-f]{5}$/, ''), p]));
  assert.equal(by.astra.status, 'Running');
  assert.equal(by['quick-bite'].status, 'Completed');
  assert.equal(by['broken-ci'].status, 'CrashLoopBackOff');
  assert.deepEqual(by.astra.weekly, [0, 0, 0, 0, 0, 1, 1, 1]);
  assert.equal(by.astra.age, '200d');
});

test('every card renders in both themes, empty and populated', () => {
  const stats = summarize(DATA, iso(NOW).slice(0, 10));
  const pods = toPods(DATA.repos, DATA.login, NOW);
  const state = { checks: { Portfolio: [[NOW / 1000, 1, 300]], 'Quick-Bite': [[NOW / 1000, 0, 45000]] } };
  const incidents = [
    { id: 'INC-0001', key: 'widget:img.shields.io', severity: 'minor', auto: true, title: 'img.shields.io stopped serving images', detail: '12 images swapped for text fallbacks automatically', openedAt: iso(NOW - 3 * DAY), resolvedAt: iso(NOW - 3 * DAY + 47 * 60e3), resolution: 'Service back; original images restored automatically' },
    { id: 'INC-0002', key: 'endpoint:Quick-Bite', severity: 'major', auto: false, title: 'Quick-Bite is unreachable', detail: 'No response within 45s', openedAt: iso(NOW - 2 * 3600e3), resolvedAt: null, resolution: null },
  ];

  for (const theme of ['dark', 'light']) {
    assertSvg(renderOverview(DATA, stats, theme));
    assertSvg(renderLanguages(DATA, stats, theme));
    assertSvg(renderActivity(DATA, stats, theme));
    assertSvg(renderCluster(pods, theme, { namespace: 'vishwab0815' }));
    assertSvg(renderCluster([], theme, { namespace: 'vishwab0815' }));
    assertSvg(renderStatus(summarizeEndpoints(state, ENDPOINTS, NOW), theme, { now: NOW, since: iso(NOW) }));
    assertSvg(renderStatus(summarizeEndpoints({}, ENDPOINTS, NOW), theme, { now: NOW, since: undefined }));
    assertSvg(renderIncidents(incidents, theme, { now: NOW, since: iso(NOW), monitored: { widgets: 30, endpoints: 5 } }));
    assertSvg(renderIncidents([], theme, { now: NOW, since: iso(NOW), monitored: { widgets: 30, endpoints: 5 } }));
  }
});

test('status banner reflects the latest checks', () => {
  const up = { checks: Object.fromEntries(ENDPOINTS.map((e) => [e.name, [[NOW / 1000, 1, 100]]])) };
  assert.match(renderStatus(summarizeEndpoints(up, ENDPOINTS, NOW), 'dark', { now: NOW }), /All systems operational/);
  up.checks['Quick-Bite'] = [[NOW / 1000, 0, 100]];
  assert.match(renderStatus(summarizeEndpoints(up, ENDPOINTS, NOW), 'dark', { now: NOW }), /Partial outage · Quick-Bite/);
  assert.match(renderStatus(summarizeEndpoints({}, ENDPOINTS, NOW), 'dark', { now: NOW }), /Monitoring is starting/);
});

// Builds every generated image for the profile and runs the hourly checks.
//
//   node scripts/build.mjs dist
//
// env  GITHUB_TOKEN, GITHUB_USER, GITHUB_REPOSITORY   GitHub API access (or FIXTURE=path.json offline)
//      STATE_IN       previous state.json (uptime samples, incident log); missing → fresh start
//      CTF_FLAG       enables the hidden CTF fragments
//      README, HEAL_STORE  files the self-healing step may rewrite (default README.md, .github/heal-store.json)
//      SKIP_CHECKS=1  skip network checks (offline previews)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { THEMES } from './lib/svg.mjs';
import { fetchGitHub } from './data.mjs';
import { ENDPOINTS, runChecks, summarizeEndpoints } from './monitor.mjs';
import { heal, findImages, recordHealIncidents } from './heal.mjs';
import { fragments, securityTxt } from './ctf.mjs';
import { summarize, renderOverview, renderLanguages, renderActivity } from './cards/stats.mjs';
import { toPods, renderCluster } from './cards/cluster.mjs';
import { renderStatus } from './cards/status.mjs';
import { renderIncidents } from './cards/incidents.mjs';
import { renderHallOfFame } from './cards/halloffame.mjs';

const env = process.env;
const outDir = process.argv[2] ?? 'dist';
const now = Date.now();
const login = env.GITHUB_USER ?? 'vishwab0815';
const repo = env.GITHUB_REPOSITORY ?? `${login}/${login}`;
const readmePath = env.README ?? 'README.md';
const storePath = env.HEAL_STORE ?? '.github/heal-store.json';
const rawBase = `https://raw.githubusercontent.com/${repo}/output`;

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

// 1. Previous state from the output branch.
const state = await readJson(env.STATE_IN ?? '', {});
state.version = 1;

// 2. GitHub data.
if (!env.FIXTURE && !env.GITHUB_TOKEN) {
  console.error('Set GITHUB_TOKEN (or FIXTURE for an offline preview).');
  process.exit(1);
}
const data = env.FIXTURE ? await readJson(env.FIXTURE, null) : await fetchGitHub({ login, repo, token: env.GITHUB_TOKEN, now });
if (!data) throw new Error(`Could not read fixture ${env.FIXTURE}`);

// 3. Uptime checks and self-healing.
const isOwn = (url) => url.startsWith(`https://raw.githubusercontent.com/${repo}/`);
let readme = await readFile(readmePath, 'utf8');
let widgets = findImages(readme, isOwn).length;
if (!env.SKIP_CHECKS) {
  const results = await runChecks(state, ENDPOINTS, now);
  console.log('endpoints:', results.map((r) => `${r.name} ${r.ok ? 'up' : 'DOWN'} (${r.code}, ${r.ms}ms)`).join(' · '));

  const store = await readJson(storePath, {});
  const healed = await heal(readme, store, { isOwn, now });
  recordHealIncidents(state, healed, now);
  widgets = healed.monitored;
  if (healed.readme !== readme) {
    await writeFile(readmePath, healed.readme);
    readme = healed.readme;
  }
  if (JSON.stringify(healed.store) !== JSON.stringify(store)) await writeFile(storePath, `${JSON.stringify(healed.store, null, 2)}\n`);
  console.log(`heal: ${widgets} widgets monitored · ${healed.degraded.length} swapped out · ${healed.restored.length} restored`);
}

// 4. CTF fragments (only when the flag secret is configured).
const flag = env.CTF_FLAG?.trim();
const ctf = flag ? fragments(flag) : null;

// 5. Render.
const stats = summarize(data, new Date(now).toISOString().slice(0, 10));
const pods = toPods(data.repos, login, now);
const endpoints = summarizeEndpoints(state, ENDPOINTS, now);
const since = state.monitoringSince ?? new Date(now).toISOString();
const files = {};
for (const theme of Object.keys(THEMES)) {
  files[`overview-${theme}.svg`] = renderOverview(data, stats, theme);
  files[`languages-${theme}.svg`] = renderLanguages(data, stats, theme);
  files[`activity-${theme}.svg`] = renderActivity(data, stats, theme);
  files[`cluster-${theme}.svg`] = renderCluster(pods, theme, { namespace: login, hidden: ctf?.pod });
  files[`status-${theme}.svg`] = renderStatus(endpoints, theme, { now, since, hidden: theme === 'dark' ? ctf?.status : null });
  files[`incidents-${theme}.svg`] = renderIncidents(state.incidents ?? [], theme, { now, since, monitored: { widgets, endpoints: ENDPOINTS.length } });
  files[`halloffame-${theme}.svg`] = renderHallOfFame(data.solvers ?? [], theme, { live: Boolean(flag) });
}
files['security.txt'] = securityTxt({ email: 'vishwab0815@gmail.com', canonical: `${rawBase}/security.txt`, fragment: ctf?.security, now });
files['state.json'] = `${JSON.stringify(state)}\n`;

await mkdir(outDir, { recursive: true });
await Promise.all(Object.entries(files).map(([name, body]) => writeFile(join(outDir, name), body)));
console.log(`wrote ${Object.keys(files).length} files to ${outDir}/ ·`, {
  contributions: stats.total, streak: stats.current, pods: pods.length,
  openIncidents: (state.incidents ?? []).filter((i) => !i.resolvedAt).length,
  solvers: data.solvers?.length ?? 0, ctf: Boolean(flag),
});

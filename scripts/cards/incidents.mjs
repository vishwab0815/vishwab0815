// Public incident log: what broke, what the automation did about it, and how long it took.

import { THEMES, esc, frame, dot, duration, ago, truncate, shortDate } from '../lib/svg.mjs';

const SHOW = 5;
const DAY = 86400e3;

export function incidentStats(incidents, now) {
  const recent = incidents.filter((i) => now - Date.parse(i.openedAt) <= 90 * DAY);
  const resolved = recent.filter((i) => i.resolvedAt);
  const mttr = resolved.length
    ? resolved.reduce((s, i) => s + (Date.parse(i.resolvedAt) - Date.parse(i.openedAt)), 0) / resolved.length
    : null;
  return { total: recent.length, auto: recent.filter((i) => i.auto).length, open: recent.filter((i) => !i.resolvedAt).length, mttr };
}

export function renderIncidents(incidents, theme, { now, monitored, since }) {
  const t = THEMES[theme];
  const W = 900;
  const list = [...incidents].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, SHOW);
  const s = incidentStats(incidents, now);
  const watching = `${monitored.widgets} widgets and ${monitored.endpoints} endpoints watched hourly`;

  if (!list.length) {
    const H = 196;
    return frame({
      width: W, height: H, theme, title: 'Incident log · self-healing', meta: watching,
      label: `Incident log: no incidents recorded. ${watching}.`,
      body: `<g class="fade" style="animation-delay:.15s">
  <circle cx="${W / 2}" cy="98" r="20" fill="${t.good}" fill-opacity=".14"/>
  <path d="M${W / 2 - 8} 98.5l5.5 5.5 11-11.5" fill="none" stroke="${t.good}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${W / 2}" y="146" font-size="15" font-weight="600" text-anchor="middle">No incidents recorded</text>
  <text x="${W / 2}" y="168" class="label" text-anchor="middle">Broken widgets get swapped for fallbacks and restored automatically · watching since ${shortDate(since?.slice(0, 10))}</text>
</g>`,
    });
  }

  const top = 84, rowH = 56;
  const H = top + (list.length - 1) * rowH + 54;
  const sev = { major: t.bad, minor: t.warn };
  const rows = list.map((inc, i) => {
    const y = top + i * rowH;
    const open = !inc.resolvedAt;
    const c = open ? sev[inc.severity] ?? t.warn : t.good;
    const pill = open ? `Ongoing · ${duration(now - Date.parse(inc.openedAt))}` : `Resolved in ${duration(Date.parse(inc.resolvedAt) - Date.parse(inc.openedAt))}`;
    const pillW = pill.length * 6.4 + 22;
    const detail = inc.resolution ? `${inc.detail} → ${inc.resolution}` : inc.detail;
    return `<g class="fade" style="animation-delay:${(0.15 + i * 0.08).toFixed(2)}s">
  ${i ? `<line x1="24" x2="${W - 24}" y1="${y - 20}" y2="${y - 20}" stroke="${t.grid}"/>` : ''}
  ${dot(30, y + 4, sev[inc.severity] ?? t.warn, open)}
  <text x="44" y="${y + 9}" class="mono small">${inc.id}</text>
  <text x="112" y="${y + 9}" font-size="13.5" font-weight="600">${esc(truncate(inc.title, 64))}${inc.auto ? `<tspan class="small" dx="8" fill="${t.accent2}" style="fill:${t.accent2}">⚡ auto-remediated</tspan>` : ''}</text>
  <text x="112" y="${y + 28}" class="small">${esc(truncate(detail, 104))}</text>
  <rect x="${(W - 24 - pillW).toFixed(1)}" y="${y - 7}" width="${pillW.toFixed(1)}" height="22" rx="11" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-opacity=".4"/>
  <text x="${(W - 24 - pillW / 2).toFixed(1)}" y="${y + 8}" font-size="11.5" font-weight="600" text-anchor="middle" fill="${c}" style="fill:${c}">${pill}</text>
  <text x="${W - 24}" y="${y + 28}" class="small" text-anchor="end">${ago(inc.openedAt, now)}</text>
</g>`;
  }).join('\n');

  const summary = `${s.total} incident${s.total === 1 ? '' : 's'} in 90 days · ${s.auto} auto-remediated${s.mttr === null ? '' : ` · MTTR ${duration(s.mttr)}`}`;
  return frame({
    width: W, height: H, theme, title: 'Incident log · self-healing', meta: watching,
    label: `Incident log: ${summary}. Latest: ${list.map((i) => `${i.id} ${i.title}`).join('; ')}`,
    body: `<text x="24" y="60" class="label">${summary}</text>\n${rows}`,
  });
}

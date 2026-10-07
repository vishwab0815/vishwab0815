// Overview, languages and contribution-activity cards.

import { THEMES, esc, fmt, MONTHS, shortDate, frame } from '../lib/svg.mjs';

// Notebook outputs inflate byte counts and drown out real source code.
const EXCLUDED_LANGUAGES = new Set(['Jupyter Notebook']);
const TOP_LANGUAGES = 6;

// ---------------------------------------------------------------- stats

export function summarize(data, today = new Date().toISOString().slice(0, 10)) {
  const days = data.days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));

  let longest = 0, run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today still counts as "in progress": a streak survives until a full day is missed.
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  for (; i >= 0 && days[i].count > 0; i--) current++;

  const total = days.reduce((s, d) => s + d.count, 0);
  const best = days.reduce((b, d) => (d.count > b.count ? d : b), { date: null, count: 0 });

  // Weekly buckets (Sunday-start, matching GitHub's calendar) for the last 52 weeks.
  const allWeeks = [];
  for (const d of days) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    if (!allWeeks.length || dt.getUTCDay() === 0) allWeeks.push({ start: d.date, count: 0 });
    allWeeks[allWeeks.length - 1].count += d.count;
  }
  const weeks = allWeeks.slice(-52);

  const bytes = new Map();
  for (const r of data.repos)
    for (const l of r.languages) {
      if (EXCLUDED_LANGUAGES.has(l.name)) continue;
      const prev = bytes.get(l.name) ?? { name: l.name, color: l.color, size: 0 };
      prev.size += l.size;
      bytes.set(l.name, prev);
    }
  const sorted = [...bytes.values()].sort((a, b) => b.size - a.size);
  const totalBytes = sorted.reduce((s, l) => s + l.size, 0) || 1;
  const languages = sorted.slice(0, TOP_LANGUAGES).map((l) => ({ ...l, pct: (l.size / totalBytes) * 100 }));
  const rest = sorted.slice(TOP_LANGUAGES).reduce((s, l) => s + l.size, 0);
  if (rest > 0) languages.push({ name: 'Other', color: null, size: rest, pct: (rest / totalBytes) * 100 });

  return {
    total, current, longest, best, weeks, languages,
    stars: data.repos.reduce((s, r) => s + r.stars, 0),
    activeDays: days.filter((d) => d.count > 0).length,
  };
}

// ---------------------------------------------------------------- cards

export function renderOverview(data, stats, theme) {
  const t = THEMES[theme];
  const metrics = [
    ['Stars earned', stats.stars, t.warm],
    [`Commits in ${new Date().getUTCFullYear()}`, data.commitsThisYear, t.good],
    ['Pull requests', data.pullRequests, t.accent2],
    ['Public repos', data.publicRepos, t.accent],
    ['Followers', data.followers, t.good],
    ['Active days', stats.activeDays, t.accent2],
  ];
  const body = metrics.map(([label, value, color], i) => {
    const x = 24 + (i % 3) * 136;
    const y = 76 + Math.floor(i / 3) * 70;
    return `<g class="fade" style="animation-delay:${0.1 + i * 0.08}s">
  <circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${color}"/>
  <text x="${x + 14}" y="${y}" class="label">${esc(label)}</text>
  <text x="${x}" y="${y + 32}" class="num">${fmt(value)}</text>
</g>`;
  }).join('\n');
  return frame({
    width: 440, height: 220, theme, title: 'GitHub overview',
    label: `${data.login} GitHub overview: ${metrics.map(([l, v]) => `${l} ${v}`).join(', ')}`,
    body,
  });
}

export function renderLanguages(data, stats, theme) {
  const t = THEMES[theme];
  const langs = stats.languages;
  const barX = 24, barW = 392, barY = 58;
  let x = barX;
  const segments = langs.map((l) => {
    const w = (l.pct / 100) * barW;
    const seg = `<rect x="${x.toFixed(2)}" y="${barY}" width="${Math.max(w, 0).toFixed(2)}" height="10" fill="${l.color ?? t.muted}"/>`;
    x += w;
    return seg;
  }).join('');
  const legend = langs.map((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 24 + col * 200, ly = 100 + row * 28;
    return `<g class="fade" style="animation-delay:${0.3 + i * 0.07}s">
  <circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color ?? t.muted}"/>
  <text x="${lx + 18}" y="${ly}" font-size="13">${esc(l.name)}</text>
  <text x="${lx + 182}" y="${ly}" font-size="13" text-anchor="end" class="muted" style="font-variant-numeric:tabular-nums">${l.pct.toFixed(1)}%</text>
</g>`;
  }).join('\n');
  return frame({
    width: 440, height: 220, theme, title: 'Most used languages',
    label: `Most used languages: ${langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}`,
    body: `<clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="10" rx="5"/></clipPath>
<g clip-path="url(#bar)"><g class="grow">${segments}</g></g>
${legend}`,
  });
}

// Catmull-Rom spline through the points, as cubic Bézier segments.
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function renderActivity(data, stats, theme) {
  const t = THEMES[theme];
  const W = 900, H = 330;
  const kpis = [
    ['Total contributions', fmt(stats.total), `since ${shortDate(data.createdAt.slice(0, 10))}`],
    ['Current streak', `${stats.current} day${stats.current === 1 ? '' : 's'}`, stats.current ? 'keep it going' : 'starts with the next commit'],
    ['Longest streak', `${stats.longest} day${stats.longest === 1 ? '' : 's'}`, 'personal best'],
    ['Best day', fmt(stats.best.count), shortDate(stats.best.date)],
  ];
  const kpiSvg = kpis.map(([label, value, sub], i) => {
    const x = 24 + i * 218;
    return `<g class="fade" style="animation-delay:${0.1 + i * 0.08}s">
  <text x="${x}" y="72" class="label">${esc(label)}</text>
  <text x="${x}" y="104" class="num">${esc(value)}</text>
  <text x="${x}" y="124" class="small">${esc(sub)}</text>
</g>`;
  }).join('\n');

  // Chart area
  const cx = 56, cy = 156, cw = W - cx - 28, ch = 128;
  const weeks = stats.weeks;
  const max = Math.max(4, ...weeks.map((w) => w.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const step = weeks.length > 1 ? cw / (weeks.length - 1) : 0;
  const pts = weeks.map((w, i) => [cx + i * step, cy + ch - (w.count / niceMax) * ch]);
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts.at(-1)[0].toFixed(1)},${cy + ch} L${cx},${cy + ch} Z` : '';

  const grid = [0, 1, 2, 3, 4].map((k) => {
    const y = cy + ch - (k / 4) * ch;
    return `<line x1="${cx}" x2="${cx + cw}" y1="${y}" y2="${y}" stroke="${t.grid}" ${k ? 'stroke-dasharray="3 4"' : ''}/>
<text x="${cx - 10}" y="${y + 4}" class="small" text-anchor="end">${(niceMax * k) / 4}</text>`;
  }).join('\n');

  // Label the first week of each month, skipping labels that would collide.
  let lastX = -Infinity;
  const months = weeks.map((w, i) => {
    const m = +w.start.slice(5, 7);
    const prev = weeks[i - 1];
    if (prev && +prev.start.slice(5, 7) === m) return '';
    const x = cx + i * step;
    if (x - lastX < 44) return '';
    lastX = x;
    return `<text x="${x.toFixed(1)}" y="${cy + ch + 20}" class="small" text-anchor="middle">${MONTHS[m - 1]}</text>`;
  }).join('');

  const peak = pts.reduce((b, p, i) => (weeks[i].count > weeks[b].count ? i : b), 0);
  const peakDot = weeks.length && weeks[peak].count
    ? `<g class="fade" style="animation-delay:1.6s"><circle cx="${pts[peak][0].toFixed(1)}" cy="${pts[peak][1].toFixed(1)}" r="9" fill="${t.accent}" opacity=".18"/><circle cx="${pts[peak][0].toFixed(1)}" cy="${pts[peak][1].toFixed(1)}" r="4" fill="${t.bg}" stroke="${t.accent}" stroke-width="2"/></g>`
    : '';

  return frame({
    width: W, height: H, theme, title: 'Contribution activity · last 52 weeks',
    label: `Contribution activity: ${stats.total} total contributions, current streak ${stats.current} days, longest streak ${stats.longest} days`,
    body: `<defs>
  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="${t.accent}" stop-opacity=".35"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
${kpiSvg}
${grid}
${months}
<path d="${area}" fill="url(#area)" class="fade" style="animation-delay:.8s;animation-duration:1.2s"/>
<path d="${line}" fill="none" stroke="url(#brand)" stroke-width="2.5" stroke-linecap="round" class="draw"/>
${peakDot}`,
  });
}

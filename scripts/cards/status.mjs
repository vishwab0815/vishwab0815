// Status page for the live demos: overall banner, 90 daily uptime bars, uptime % and latency.

import { THEMES, esc, frame, dot, shortDate, truncate } from '../lib/svg.mjs';

export function renderStatus(endpoints, theme, { now, since, hidden = null }) {
  const t = THEMES[theme];
  const W = 900, top = 124, rowH = 52, barX = 244, barW = 4.6, gap = 1.4;
  const H = top + endpoints.length * rowH + 30;

  const down = endpoints.filter((e) => e.up === false);
  const known = endpoints.some((e) => e.up !== null);
  const [state, color] = !known ? ['Monitoring is starting', t.muted]
    : !down.length ? ['All systems operational', t.good]
    : down.length === endpoints.length ? ['Major outage', t.bad]
    : [`Partial outage · ${down.map((e) => e.name).join(', ')}`, t.warn];

  const checkedAt = new Date(now).toISOString();
  const banner = `<rect x="24" y="54" width="${W - 48}" height="42" rx="8" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".35"/>
${dot(46, 75, color, known)}
<text x="62" y="80" font-size="14" font-weight="600">${esc(state)}</text>
<text x="${W - 40}" y="80" class="small" text-anchor="end">checked hourly · last run ${shortDate(checkedAt.slice(0, 10))}, ${checkedAt.slice(11, 16)} UTC</text>`;

  const barColor = (r) => (r === null ? t.grid : r === 1 ? t.good : r === 0 ? t.bad : t.warn);
  const rows = endpoints.map((e, i) => {
    const y = top + i * rowH;
    const bars = e.days.map((r, d) =>
      `<rect x="${(barX + d * (barW + gap)).toFixed(1)}" y="${y}" width="${barW}" height="28" rx="1.5" fill="${barColor(r)}"/>`).join('');
    const upColor = e.up === null ? t.muted : e.up ? t.good : t.bad;
    return `<g class="fade" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">
  ${dot(30, y + 10, upColor, false, 4)}
  <text x="42" y="${y + 14}" font-size="13" font-weight="600">${esc(e.name)}</text>
  <text x="42" y="${y + 31}" class="small mono" style="font-size:10.5px">${esc(truncate(e.host, 30))}</text>
  <g class="rise">${bars}</g>
  <text x="${W - 24}" y="${y + 14}" font-size="13" font-weight="600" text-anchor="end" class="tab">${e.uptime === null ? '—' : `${e.uptime >= 99.995 ? '100' : e.uptime.toFixed(2)}%`}</text>
  <text x="${W - 24}" y="${y + 31}" class="small tab" text-anchor="end">${e.avgMs === null ? 'no data' : `${e.avgMs.toLocaleString('en-US')} ms avg`}</text>
</g>`;
  }).join('\n');

  const barsEnd = barX + (endpoints[0]?.days.length ?? 90) * (barW + gap) - gap;
  const legendY = top + endpoints.length * rowH + 4;
  const legend = `<text x="24" y="${legendY}" class="small">monitoring since ${shortDate(since?.slice(0, 10))}</text>
<text x="${barX}" y="${legendY}" class="small">90 days ago</text>
<text x="${barsEnd.toFixed(1)}" y="${legendY}" class="small" text-anchor="end">today</text>`;

  // Fragment 2 of the CTF lives only in the dark variant: "every status page has a dark side".
  const secret = hidden ? `<text x="0" y="${H}" font-size="1" opacity="0" aria-hidden="true">maintenance-note: ${esc(hidden)}</text>` : '';

  return frame({
    width: W, height: H, theme,
    title: 'Status · live demos',
    meta: `${endpoints.length} endpoints`,
    label: `Status of live demos: ${state}. ${endpoints.map((e) => `${e.name} ${e.uptime === null ? 'no data' : `${e.uptime.toFixed(2)}% uptime`}`).join(', ')}`,
    body: `${banner}\n${rows}\n${legend}\n${secret}`,
  });
}

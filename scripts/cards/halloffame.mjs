// Hall of fame for the profile CTF. Avatars are embedded as data URIs (SVG-in-<img> can't load URLs).

import { THEMES, esc, frame, shortDate, truncate } from '../lib/svg.mjs';

const PER_ROW = 6;
export const MAX_SOLVERS = 18;

export function renderHallOfFame(solvers, theme, { live }) {
  const t = THEMES[theme];
  const W = 900;
  const meta = live ? `${solvers.length} solver${solvers.length === 1 ? '' : 's'}` : 'launching soon';

  if (!solvers.length) {
    const H = 190;
    const [headline, sub] = live
      ? ['Flag uncaptured', 'Three fragments are hidden in this profile. Nobody has assembled the flag yet. First blood is waiting.']
      : ['The hunt opens soon', 'Three fragments will be hidden across this profile.'];
    return frame({
      width: W, height: H, theme, title: 'Capture the flag · hall of fame', meta,
      label: `CTF hall of fame: ${headline}.`,
      body: `<g class="fade" style="animation-delay:.15s">
  <g transform="translate(${W / 2 - 12} 62)">
    <line x1="3" y1="0" x2="3" y2="44" stroke="${t.muted}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M4 2h20l-5 8 5 8H4z" fill="${t.bad}">
      <animate attributeName="d" dur="1.6s" repeatCount="indefinite" values="M4 2h20l-5 8 5 8H4z;M4 3h20l-6 8 6 7H4z;M4 2h20l-5 8 5 8H4z"/>
    </path>
  </g>
  <text x="${W / 2}" y="138" font-size="16" font-weight="700" text-anchor="middle">${headline}</text>
  <text x="${W / 2}" y="162" class="label" text-anchor="middle">${sub}</text>
</g>`,
    });
  }

  const shown = solvers.slice(0, MAX_SOLVERS);
  const cellW = (W - 48) / PER_ROW, cellH = 128, top = 62;
  const rows = Math.ceil(shown.length / PER_ROW);
  const H = top + rows * cellH + (solvers.length > shown.length ? 30 : 10);
  const cells = shown.map((s, i) => {
    const cx = 24 + (i % PER_ROW) * cellW + cellW / 2;
    const cy = top + Math.floor(i / PER_ROW) * cellH + 38;
    const first = i === 0;
    const ring = first ? t.warn : t.border;
    const avatar = s.avatar
      ? `<image href="${s.avatar}" x="${cx - 30}" y="${cy - 30}" width="60" height="60" clip-path="url(#av${i})" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${cx}" cy="${cy}" r="30" fill="${t.grid}"/><text x="${cx}" y="${cy + 8}" font-size="22" font-weight="700" text-anchor="middle" class="muted">${esc(s.login[0].toUpperCase())}</text>`;
    return `<g class="fade" style="animation-delay:${(0.1 + i * 0.06).toFixed(2)}s">
  <clipPath id="av${i}"><circle cx="${cx}" cy="${cy}" r="30"/></clipPath>
  ${avatar}
  <circle cx="${cx}" cy="${cy}" r="31.5" fill="none" stroke="${ring}" stroke-width="${first ? 2.5 : 1.5}"/>
  ${first ? `<rect x="${cx - 38}" y="${cy + 24}" width="76" height="17" rx="8.5" fill="${t.warn}"/><text x="${cx}" y="${cy + 36}" font-size="9.5" font-weight="700" text-anchor="middle" fill="${t.bg}" style="fill:${t.bg}" letter-spacing=".6">FIRST BLOOD</text>` : ''}
  <text x="${cx}" y="${cy + 58}" font-size="12.5" font-weight="600" text-anchor="middle">@${esc(truncate(s.login, 16))}</text>
  <text x="${cx}" y="${cy + 74}" class="small" text-anchor="middle">#${i + 1} · ${shortDate(s.solvedAt.slice(0, 10))}</text>
</g>`;
  }).join('\n');

  const more = solvers.length > shown.length
    ? `<text x="${W / 2}" y="${H - 14}" class="small" text-anchor="middle">+ ${solvers.length - shown.length} more</text>`
    : '';

  return frame({
    width: W, height: H, theme, title: 'Capture the flag · hall of fame', meta,
    label: `CTF hall of fame: ${solvers.map((s) => s.login).join(', ')}`,
    body: `${cells}\n${more}`,
  });
}

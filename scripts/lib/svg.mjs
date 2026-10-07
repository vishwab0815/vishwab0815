// Shared look for every generated card: GitHub's own palette, one frame, one set of animations.

export const THEMES = {
  dark: {
    bg: '#0D1117', border: '#30363D', text: '#E6EDF3', muted: '#8B949E', grid: '#21262D',
    accent: '#58A6FF', accent2: '#A371F7', good: '#3FB950', warn: '#D29922', bad: '#F85149', warm: '#F78166',
  },
  light: {
    bg: '#FFFFFF', border: '#D0D7DE', text: '#1F2328', muted: '#59636E', grid: '#EAEEF2',
    accent: '#0969DA', accent2: '#8250DF', good: '#1A7F37', warn: '#9A6700', bad: '#CF222E', warm: '#CF222E',
  },
};

export const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
export const MONO = `ui-monospace,SFMono-Regular,'Cascadia Code',Consolas,'Liberation Mono',Menlo,monospace`;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HOUR = 3600e3, DAY = 24 * HOUR;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmt = (n) => (n >= 100000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString('en-US'));

export const shortDate = (iso) =>
  iso ? `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}` : '—';

export const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// "47m", "5h 12m", "3d"
export function duration(ms) {
  const m = Math.max(1, Math.round(ms / 60e3));
  if (m < 60) return `${m}m`;
  if (ms < 2 * DAY) return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
  return `${Math.floor(ms / DAY)}d`;
}

// "just now", "3h ago", "4d ago"
export function ago(iso, now) {
  const ms = now - Date.parse(iso);
  if (ms < 5 * 60e3) return 'just now';
  if (ms < HOUR) return `${Math.round(ms / 60e3)}m ago`;
  if (ms < 2 * DAY) return `${Math.round(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

export function frame({ width, height, theme, title, meta = '', label, body }) {
  const t = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>
  text { font-family: ${FONT}; fill: ${t.text}; }
  .mono { font-family: ${MONO}; }
  .title { font-size: 15px; font-weight: 600; }
  .muted { fill: ${t.muted}; }
  .label { font-size: 12px; fill: ${t.muted}; }
  .num { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .small { font-size: 11px; fill: ${t.muted}; }
  .tab { font-variant-numeric: tabular-nums; }
  .fade { animation: fade .6s ease-out backwards; }
  .grow { transform-box: fill-box; transform-origin: left center; animation: grow .9s cubic-bezier(.2,.7,.2,1) backwards; }
  .rise { transform-box: fill-box; transform-origin: center bottom; animation: rise .8s cubic-bezier(.2,.7,.2,1) backwards; }
  .draw { stroke-dasharray: 2400; stroke-dashoffset: 0; animation: draw 2s ease-out backwards; }
  .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 2s ease-out infinite; }
  @keyframes fade { from { opacity: 0; transform: translateY(6px); } }
  @keyframes grow { from { transform: scaleX(0); } }
  @keyframes rise { from { transform: scaleY(0); } }
  @keyframes draw { from { stroke-dashoffset: 2400; } }
  @keyframes pulse { from { transform: scale(1); opacity: .7; } to { transform: scale(2.6); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } .pulse { display: none; } }
</style>
<defs>
  <linearGradient id="brand" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/>
  </linearGradient>
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<rect x="24" y="22" width="4" height="16" rx="2" fill="url(#brand)"/>
<text x="36" y="35" class="title">${esc(title)}</text>
${meta ? `<text x="${width - 24}" y="35" class="small" text-anchor="end">${esc(meta)}</text>` : ''}
${body}
</svg>
`;
}

// A status dot that breathes when `live`.
export function dot(x, y, color, live = false, r = 4) {
  return `${live ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" class="pulse"/>` : ''}<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}

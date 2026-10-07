// "kubectl get pods" for the GitHub account: every public repo is a pod.
//   Running           pushed within the last 30 days
//   Completed         quiet for longer (or archived)
//   CrashLoopBackOff  latest commit on the default branch has failing checks

import { createHash } from 'node:crypto';
import { THEMES, esc, frame, dot, truncate } from '../lib/svg.mjs';

const DAY = 86400e3;
const WEEKS = 8;
export const MAX_PODS = 10;
const SHORT_LANG = { 'Jupyter Notebook': 'Jupyter' };

function kubeAge(ms) {
  const h = Math.floor(ms / 3600e3);
  if (h < 48) return `${Math.max(h, 0)}h`;
  const d = Math.floor(ms / DAY);
  return d < 365 ? `${d}d` : `${Math.floor(d / 365)}y${d % 365}d`;
}

export function toPods(repos, login, now) {
  return repos
    .filter((r) => r.name.toLowerCase() !== login.toLowerCase())
    .map((r) => {
      const quiet = now - Date.parse(r.pushedAt);
      const failing = r.ciState === 'FAILURE' || r.ciState === 'ERROR';
      const status = failing ? 'CrashLoopBackOff' : !r.isArchived && quiet <= 30 * DAY ? 'Running' : 'Completed';
      const weekly = new Array(WEEKS).fill(0);
      for (const d of r.commitDates ?? []) {
        const w = Math.floor((now - Date.parse(d)) / (7 * DAY));
        if (w >= 0 && w < WEEKS) weekly[WEEKS - 1 - w]++;
      }
      const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        name: `${slug}-${createHash('sha1').update(r.name).digest('hex').slice(0, 5)}`,
        status,
        weekly,
        commits7d: r.commits7d ?? 0,
        stars: r.stars,
        lang: r.primaryLanguage ? { name: SHORT_LANG[r.primaryLanguage.name] ?? r.primaryLanguage.name, color: r.primaryLanguage.color } : null,
        age: kubeAge(now - Date.parse(r.createdAt)),
        pushedAt: r.pushedAt,
      };
    })
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
}

function sparkline(values, x, y, w, h, color) {
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [x + i * step, y - (v / max) * h]);
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  return `<polygon points="${x},${y} ${line} ${x + w},${y}" fill="${color}" opacity=".15"/>
<polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}

const TYPE_SECONDS = 1.2;

// The command types itself once, then rows stream in like real kubectl output.
function typedCommand(text, t) {
  const chars = text.length + 2, charW = 8.2, width = chars * charW + 40;
  const values = Array.from({ length: chars + 1 }, (_, i) => (i * charW).toFixed(1));
  values.push(width.toFixed(1));
  return `<clipPath id="typed"><rect x="20" y="54" width="${width.toFixed(1)}" height="26">
  <animate attributeName="width" dur="${TYPE_SECONDS}s" fill="freeze" calcMode="discrete" values="${values.join(';')}"/>
</rect></clipPath>
<text x="24" y="72" class="mono reveal" font-size="13" clip-path="url(#typed)"><tspan fill="${t.good}" style="fill:${t.good}">❯</tspan> ${esc(text)}<tspan class="cursor" fill="${t.accent}" style="fill:${t.accent}"> ▍</tspan></text>`;
}

export function renderCluster(pods, theme, { namespace }) {
  const t = THEMES[theme];
  const color = { Running: t.good, Completed: t.muted, CrashLoopBackOff: t.bad };
  const shown = pods.slice(0, MAX_PODS);
  const W = 900, headY = 106, rowH = 27, firstRow = headY + 27;
  const H = firstRow + shown.length * rowH + 28;
  const C = { name: 24, status: 262, activity: 430, commits: 612, stars: 676, lang: 706, age: 876 };

  const count = (s) => pods.filter((p) => p.status === s).length;
  const summary = `${pods.length} pods · ${count('Running')} running · ${count('Completed')} completed · ${count('CrashLoopBackOff')} crashlooping`;

  const header = [
    ['NAME', C.name], ['STATUS', C.status], ['ACTIVITY (8W)', C.activity],
    ['COMMITS 7D', C.commits, 'end'], ['STARS', C.stars, 'end'], ['LANGUAGE', C.lang], ['AGE', C.age, 'end'],
  ].map(([label, x, anchor]) => `<text x="${x}" y="${headY}" class="mono small"${anchor ? ` text-anchor="${anchor}"` : ''}>${label}</text>`).join('');

  const rows = shown.map((p, i) => {
    const y = firstRow + i * rowH;
    const c = color[p.status];
    return `<g class="fade" style="animation-delay:${(TYPE_SECONDS + 0.05 + i * 0.06).toFixed(2)}s">
  ${i % 2 ? `<rect x="12" y="${y - 18}" width="${W - 24}" height="${rowH}" rx="5" fill="${t.grid}" opacity=".45"/>` : ''}
  <text x="${C.name}" y="${y}" class="mono" font-size="12.5">${esc(truncate(p.name, 28))}</text>
  ${dot(C.status + 4, y - 4, c, p.status === 'Running', 3.5)}
  <text x="${C.status + 14}" y="${y}" class="mono" font-size="12.5" fill="${c}" style="fill:${c}">${p.status}</text>
  ${sparkline(p.weekly, C.activity, y + 1, 110, 14, p.status === 'Completed' ? t.muted : t.accent)}
  <text x="${C.commits}" y="${y}" class="mono tab" font-size="12.5" text-anchor="end">${p.commits7d}</text>
  <text x="${C.stars}" y="${y}" class="mono tab" font-size="12.5" text-anchor="end">${p.stars}</text>
  ${p.lang ? `<circle cx="${C.lang + 4}" cy="${y - 4}" r="4" fill="${p.lang.color ?? t.muted}"/><text x="${C.lang + 14}" y="${y}" font-size="12.5">${esc(p.lang.name)}</text>` : `<text x="${C.lang}" y="${y}" class="small">—</text>`}
  <text x="${C.age}" y="${y}" class="mono tab muted" font-size="12.5" text-anchor="end">${p.age}</text>
</g>`;
  }).join('\n');

  return frame({
    width: W, height: H, theme,
    title: 'Live cluster',
    meta: 'every repo is a pod · refreshed hourly',
    label: `Cluster view of ${namespace}'s repositories: ${summary}`,
    body: `<style>
  .cursor { animation: blink 1.1s steps(1) infinite; } @keyframes blink { 50% { opacity: 0; } }
  .sweep { opacity: 0; animation: sweep 7s ease-in-out ${TYPE_SECONDS + 1}s infinite; }
  @keyframes sweep { 0% { opacity: 0; transform: translateY(0); } 4% { opacity: 1; } 30% { opacity: 1; transform: translateY(${shown.length * rowH}px); } 34%, 100% { opacity: 0; transform: translateY(${shown.length * rowH}px); } }
  @media (prefers-reduced-motion: reduce) { .reveal { clip-path: none !important; } .sweep { display: none; } }
</style>
<defs><linearGradient id="sweepFill" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".85" stop-color="${t.accent}" stop-opacity=".10"/><stop offset="1" stop-color="${t.accent}" stop-opacity=".45"/>
</linearGradient></defs>
${typedCommand(`kubectl get pods -n ${namespace} --sort-by=.status.lastPush`, t)}
<line x1="24" x2="${W - 24}" y1="${headY + 9}" y2="${headY + 9}" stroke="${t.border}"/>
${header}
${rows}
<rect x="12" y="${firstRow - 18 - 34}" width="${W - 24}" height="36" fill="url(#sweepFill)" class="sweep"/>
<text x="24" y="${H - 16}" class="small mono">${summary}</text>
<text x="${W - 24}" y="${H - 16}" class="small" text-anchor="end">status from push activity and CI checks</text>`,
  });
}

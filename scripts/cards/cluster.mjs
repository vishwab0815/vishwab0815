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

export function renderCluster(pods, theme, { namespace, hidden = null }) {
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
    return `<g class="fade" style="animation-delay:${(0.15 + i * 0.06).toFixed(2)}s">
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

  // Fragment 1 of the CTF: a kube-system pod that is in the source but never drawn.
  const secret = hidden
    ? `<g visibility="hidden" aria-hidden="true"><text x="24" y="${H - 4}" class="mono" font-size="1">kube-system  ctf-fragment-1  1/1  Running  annotations: fragment.vishwab0815.dev/b64=${esc(hidden)}</text></g>`
    : '';

  return frame({
    width: W, height: H, theme,
    title: 'Live cluster',
    meta: 'every repo is a pod · refreshed hourly',
    label: `Cluster view of ${namespace}'s repositories: ${summary}`,
    body: `<text x="24" y="72" class="mono" font-size="13"><tspan fill="${t.good}" style="fill:${t.good}">❯</tspan> kubectl get pods -n ${esc(namespace)} --sort-by=.status.lastPush</text>
<line x1="24" x2="${W - 24}" y1="${headY + 9}" y2="${headY + 9}" stroke="${t.border}"/>
${header}
${rows}
<text x="24" y="${H - 16}" class="small mono">${summary}</text>
<text x="${W - 24}" y="${H - 16}" class="small" text-anchor="end">status from push activity and CI checks</text>
${secret}`,
  });
}

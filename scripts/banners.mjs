// Animated banners for the featured projects. Static assets: run once after editing, then commit.
//
//   node scripts/banners.mjs        → assets/projects/*.svg
//
// Each banner loops forever with CSS/SMIL only (GitHub renders SVG through <img>: no JS, no external
// resources). Every element's resting style is its "finished" frame, so reduced-motion users see a
// complete still image.

import { mkdir, writeFile } from 'node:fs/promises';
import { FONT, MONO, esc } from './lib/svg.mjs';

const W = 840, H = 240;
const C = {
  text: '#E6EDF3', muted: '#8B949E', border: '#30363D', grid: '#21262D', panel: '#010409',
  blue: '#58A6FF', purple: '#A371F7', green: '#3FB950', red: '#F85149', orange: '#FFA657', yellow: '#E3B341', pink: '#FF7AC6', cyan: '#39D0D8',
};

function banner({ label, tint = '#111A2E', css = '', defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>
  .mono { font-family: ${MONO}; }
  .sans { font-family: ${FONT}; }
${css}
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } .reveal { clip-path: none !important; } }
</style>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1117"/><stop offset="1" stop-color="${tint}"/></linearGradient>
  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${C.text}" opacity=".06"/></pattern>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
${defs}
</defs>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#dots)"/>
${body}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="${C.border}"/>
</svg>
`;
}

// Keyframes that keep an element hidden until `at`% of the loop, then visible until `out`%.
// Resting style stays visible, so a disabled animation shows the finished frame.
const appear = (name, at, out = 92) =>
  `@keyframes ${name} { 0%, ${Math.max(at - 0.1, 0)}% { opacity: 0; transform: translateY(6px); } ${at + 3}%, ${out}% { opacity: 1; transform: none; } ${out + 4}%, 100% { opacity: 0; } }`;

// SMIL "typing": a clip rect whose width steps one character at a time, holds, then resets.
function typing(id, { x, y, h, chars, charW, dur, start = 0, end }) {
  const values = [], times = [];
  for (let i = 0; i <= chars; i++) {
    values.push((i * charW).toFixed(1));
    times.push((start + ((end - start) * i) / chars).toFixed(4));
  }
  if (start > 0) { values.unshift('0'); times.unshift('0'); }
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${(chars * charW).toFixed(1)}" height="${h}">
  <animate attributeName="width" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" values="${values.join(';')}" keyTimes="${times.join(';')}"/>
</rect></clipPath>`;
}

// Runs of spaces collapse in SVG text; non-breaking spaces keep monospace alignment.
const keep = (s) => s.replace(/ {2,}|^ /g, (m) => '&#160;'.repeat(m.length));

// Deterministic pseudo-random numbers so regenerating gives identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ---------------------------------------------------------------- ASTRA: an incident, healed

function astra() {
  const nodes = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 6; c++) nodes.push({ x: 60 + c * 72 + (r % 2) * 36, y: 62 + r * 58, r, c });
  const at = (r, c) => nodes.find((n) => n.r === r && n.c === c);
  const edges = [];
  for (const n of nodes) {
    const right = at(n.r, n.c + 1);
    if (right) edges.push([n, right]);
    const below = n.r % 2 ? [at(n.r + 1, n.c), at(n.r + 1, n.c + 1)] : [at(n.r + 1, n.c - 1), at(n.r + 1, n.c)];
    for (const b of below) if (b) edges.push([n, b]);
  }
  const victim = at(1, 2);
  const paths = [[at(0, 0), at(0, 5)], [at(2, 5), at(2, 0)], [at(1, 0), at(1, 5)]];
  const logs = [
    ['ALERT ', 'api-7f9c OOMKilled', C.red, 18],
    ['RCA   ', 'mem limit 256Mi', C.purple, 32],
    ['PR    ', 'limits → 512Mi  ✓', C.orange, 46],
    ['HEALED', '3/3 ready · 41s', C.green, 60],
  ];
  return banner({
    label: 'ASTRA: an alert fires on a Kubernetes pod, the agent finds the root cause, opens a GitOps PR and the pod heals',
    tint: '#0E1A2B',
    css: `
  .victim { animation: victim 8s infinite; }
  @keyframes victim { 0%, 17% { stroke: ${C.green}; fill: ${C.green}; fill-opacity: .15; } 20%, 56% { stroke: ${C.red}; fill: ${C.red}; fill-opacity: .3; } 62%, 100% { stroke: ${C.green}; fill: ${C.green}; fill-opacity: .15; } }
  .alarm { transform-box: fill-box; transform-origin: center; opacity: 0; animation: alarm 8s infinite; }
  @keyframes alarm { 0%, 19% { opacity: 0; transform: scale(1); } 21% { opacity: .9; } 33% { opacity: 0; transform: scale(2.6); } 34% { transform: scale(1); } 36% { opacity: .9; } 48% { opacity: 0; transform: scale(2.6); } 100% { opacity: 0; } }
  .heal { transform-box: fill-box; transform-origin: center; opacity: 0; animation: heal 8s infinite; }
  @keyframes heal { 0%, 60% { opacity: 0; transform: scale(1); } 62% { opacity: .9; } 76%, 100% { opacity: 0; transform: scale(3); } }
  .beam { stroke-dasharray: 6 6; animation: beam 8s infinite; }
  @keyframes beam { 0%, 29% { opacity: 0; } 32%, 56% { opacity: 1; stroke-dashoffset: -60; } 60%, 100% { opacity: 0; stroke-dashoffset: -80; } }
  ${logs.map((l, i) => appear(`log${i}`, l[3])).join('\n  ')}
  ${logs.map((_, i) => `.log${i} { animation: log${i} 8s infinite; }`).join('\n  ')}`,
    body: `
${edges.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${C.border}" stroke-width="1.5"/>`).join('')}
${paths.map(([a, b], i) => `<circle r="3.5" fill="${C.blue}"><animateMotion dur="${4 + i}s" begin="${-i * 1.3}s" repeatCount="indefinite" path="M${a.x},${a.y} L${b.x},${b.y}"/></circle>`).join('')}
${nodes.filter((n) => n !== victim).map((n) => `<circle cx="${n.x}" cy="${n.y}" r="15" fill="${C.green}" fill-opacity=".15" stroke="${C.green}" stroke-width="2"/>`).join('')}
<circle cx="${victim.x}" cy="${victim.y}" r="15" stroke="${C.red}" stroke-width="2.5" fill="none" class="alarm"/>
<circle cx="${victim.x}" cy="${victim.y}" r="15" stroke="${C.green}" stroke-width="2.5" fill="none" class="heal"/>
<circle cx="${victim.x}" cy="${victim.y}" r="15" stroke-width="2" class="victim" fill="${C.green}" fill-opacity=".15" stroke="${C.green}"/>
<path d="M${victim.x + 18},${victim.y} C 380 120, 440 96, 506 96" fill="none" stroke="${C.purple}" stroke-width="2" class="beam"/>
<rect x="506" y="36" width="306" height="168" rx="12" fill="${C.panel}" fill-opacity=".75" stroke="${C.border}"/>
<text x="526" y="66" class="mono" font-size="16" fill="${C.muted}">astra · incident timeline</text>
${logs.map(([tag, msg, color], i) => `<text x="526" y="${102 + i * 28}" class="mono log${i}" font-size="17" fill="${C.text}"><tspan fill="${color}">${keep(tag)}</tspan>&#160;${keep(esc(msg))}</text>`).join('\n')}
<text x="40" y="224" class="mono" font-size="17" fill="${C.muted}">self-healing kubernetes · langgraph · gitops</text>`,
  });
}

// ---------------------------------------------------------------- FORENSICS: scan, heatmap, verdict

function forensics() {
  const rand = rng(7);
  const cols = 22, rows = 9, cw = 9.6, ch = 16, sx = 260, sy = 52;
  const cells = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const v = Math.max(0, Math.min(1, (1 - r / rows) * 0.7 + rand() * 0.5 - (c > 12 && c < 17 ? -0.25 : 0.1)));
      cells.push(`<rect x="${(sx + c * cw).toFixed(1)}" y="${sy + r * ch}" width="${cw - 1.6}" height="${ch - 2}" rx="1.5" fill="${C.blue}" opacity="${(0.08 + v * 0.75).toFixed(2)}"/>`);
    }
  return banner({
    label: 'Deepfake Forensics: a face image is scanned, a Grad-CAM heatmap and a flagged audio window appear, and a verdict with confidence is shown',
    tint: '#1A1222',
    defs: `<radialGradient id="heat" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="${C.red}" stop-opacity=".75"/><stop offset=".45" stop-color="${C.orange}" stop-opacity=".5"/>
    <stop offset=".75" stop-color="${C.yellow}" stop-opacity=".25"/><stop offset="1" stop-color="${C.yellow}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.blue}" stop-opacity="0"/><stop offset="1" stop-color="${C.blue}" stop-opacity=".55"/></linearGradient>
  <clipPath id="frame"><rect x="36" y="28" width="190" height="184" rx="10"/></clipPath>`,
    css: `
  .scan { opacity: 0; animation: scan 7s infinite; }
  @keyframes scan { 0% { opacity: 1; transform: translateY(0); } 34% { opacity: 1; transform: translateY(184px); } 35%, 100% { opacity: 0; transform: translateY(184px); } }
  .play { opacity: 0; animation: play 7s infinite; }
  @keyframes play { 0% { opacity: 1; transform: translateX(0); } 34% { opacity: 1; transform: translateX(211px); } 35%, 100% { opacity: 0; } }
  .heat { animation: heat 7s infinite; }
  @keyframes heat { 0%, 34% { opacity: 0; } 46%, 88% { opacity: .9; } 95%, 100% { opacity: 0; } }
  .flag { animation: heat 7s infinite; }
  .bar { transform-box: fill-box; transform-origin: left center; animation: bar 7s infinite; }
  @keyframes bar { 0%, 48% { transform: scaleX(0); } 68%, 92% { transform: scaleX(1); } 97%, 100% { transform: scaleX(0); } }
  ${appear('v1', 48)} ${appear('v2', 66)}
  .v1 { animation: v1 7s infinite; } .v2 { animation: v2 7s infinite; }`,
    body: `
<rect x="36" y="28" width="190" height="184" rx="10" fill="${C.panel}" fill-opacity=".7" stroke="${C.border}"/>
<g clip-path="url(#frame)">
  <path d="M56 212 Q131 136 206 212 Z" fill="#2D333B"/>
  <ellipse cx="131" cy="100" rx="42" ry="52" fill="#2D333B"/>
  <ellipse cx="116" cy="94" rx="6" ry="4" fill="${C.muted}"/><ellipse cx="146" cy="94" rx="6" ry="4" fill="${C.muted}"/>
  <path d="M118 126 Q131 134 144 126" stroke="${C.muted}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="134" cy="96" rx="56" ry="40" fill="url(#heat)" class="heat"/>
  <rect x="36" y="-2" width="190" height="30" fill="url(#scan)" class="scan"/>
</g>
<path d="M82 46 v-10 h12 M168 36 h12 v10 M180 156 v10 h-12 M94 166 h-12 v-10" fill="none" stroke="${C.blue}" stroke-width="2.5" stroke-linecap="round"/>
<text x="260" y="40" class="mono" font-size="15" fill="${C.muted}">log-Mel spectrogram</text>
${cells.join('')}
<rect x="${sx + 13 * cw - 2}" y="${sy - 3}" width="${4 * cw + 2}" height="${rows * ch + 4}" rx="4" fill="none" stroke="${C.red}" stroke-width="2.5" class="flag"/>
<rect x="${sx}" y="${sy - 4}" width="2" height="${rows * ch + 6}" fill="${C.text}" class="play"/>
<text x="260" y="214" class="mono" font-size="15" fill="${C.muted}">image · audio · video</text>
<text x="510" y="70" class="mono" font-size="16" fill="${C.muted}" letter-spacing="2">VERDICT</text>
<text x="510" y="110" class="sans v1" font-size="32" font-weight="700" fill="${C.red}">Manipulated</text>
<rect x="510" y="130" width="290" height="12" rx="6" fill="${C.grid}"/>
<rect x="510" y="130" width="273" height="12" rx="6" fill="${C.red}" class="bar"/>
<text x="510" y="172" class="mono v2" font-size="18" fill="${C.text}">94.2% confidence</text>
<text x="510" y="202" class="mono" font-size="15" fill="${C.muted}">Grad-CAM evidence · PDF report</text>`,
  });
}

// ---------------------------------------------------------------- PhishGuard: a URL, three checks, blocked

function phishguard() {
  const url = 'https://paypa1-secure.co/verify-account';
  const checks = [
    ['SSL certificate', 'self-signed', 30],
    ['Domain age', '3 days', 40],
    ['IP reputation', 'blocklisted', 50],
  ];
  return banner({
    label: 'PhishGuard: a suspicious URL is typed, SSL, domain age and IP reputation checks fail, and the shield flags it as phishing with a risk score of 94',
    tint: '#22121A',
    defs: typing('url', { x: 92, y: 36, h: 40, chars: url.length, charW: 12, dur: 8, end: 0.24 }),
    css: `
  ${checks.map((c, i) => appear(`c${i}`, c[2])).join('\n  ')}
  ${checks.map((_, i) => `.c${i} { animation: c${i} 8s infinite; }`).join(' ')}
  .shield { animation: shield 8s infinite; }
  @keyframes shield { 0%, 58% { fill: ${C.grid}; } 62%, 92% { fill: ${C.red}; } 97%, 100% { fill: ${C.grid}; } }
  .ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ring 8s infinite; }
  @keyframes ring { 0%, 60% { opacity: 0; transform: scale(1); } 62% { opacity: .8; } 80%, 100% { opacity: 0; transform: scale(1.5); } }
  ${appear('verdict', 62)} .verdict { animation: verdict 8s infinite; }
  .caret { animation: caret 1s steps(1) infinite; } @keyframes caret { 50% { opacity: 0; } }`,
    body: `
<rect x="36" y="30" width="768" height="52" rx="26" fill="${C.panel}" fill-opacity=".8" stroke="${C.border}"/>
<g transform="translate(58 44)" fill="none" stroke="${C.red}" stroke-width="2.5" stroke-linecap="round">
  <rect x="0" y="10" width="20" height="15" rx="3" fill="${C.red}" fill-opacity=".2"/><path d="M4 10 V6 a6 6 0 0 1 11 -3"/>
</g>
<text x="92" y="64" class="mono reveal" font-size="20" fill="${C.text}" clip-path="url(#url)">${esc(url)}</text>
${checks.map(([name, value], i) => {
    const y = 124 + i * 36;
    return `<g class="c${i}"><text x="56" y="${y}" class="mono" font-size="19" fill="${C.text}">${name}</text>
<line x1="${56 + name.length * 11.4 + 10}" x2="400" y1="${y - 6}" y2="${y - 6}" stroke="${C.border}" stroke-dasharray="2 5"/>
<text x="410" y="${y}" class="mono" font-size="19" fill="${C.red}">${value}</text><text x="560" y="${y}" class="mono" font-size="20" font-weight="700" fill="${C.red}">✕</text></g>`;
  }).join('\n')}
<path d="M690 100 l46 17 v34 c0 29 -21 47 -46 57 c-25 -10 -46 -28 -46 -57 v-34 z" fill="none" stroke="${C.red}" stroke-width="3" class="ring"/>
<path d="M690 100 l46 17 v34 c0 29 -21 47 -46 57 c-25 -10 -46 -28 -46 -57 v-34 z" class="shield" fill="${C.red}" stroke="${C.border}" stroke-width="2"/>
<text x="690" y="162" class="sans" font-size="32" font-weight="800" fill="${C.text}" text-anchor="middle">94</text>
<text x="690" y="182" class="mono" font-size="12" fill="${C.text}" text-anchor="middle" letter-spacing="2">RISK</text>
<text x="690" y="232" class="mono verdict" font-size="17" font-weight="700" fill="${C.red}" text-anchor="middle" letter-spacing="2">PHISHING</text>`,
  });
}

// ---------------------------------------------------------------- AlgoPilotX: a live Heikin-Ashi chart

function algopilot() {
  // Hand-shaped closes: chop, a 3-candle breakout long, a trailing-stop ride, then the exit.
  const closes = [100, 99.2, 99.6, 98.8, 98.3, 98.9, 98.1, 97.6, 98.2, 97.9, 97.2, 97.8, 97.4, 97.0, 97.9, 98.8, 99.9, 100.6, 101.5, 101.1, 102.2, 103.0, 102.6, 103.6, 104.1, 103.2, 102.4, 102.0];
  const rand = rng(3);
  let haOpen = closes[0];
  const candles = closes.map((c, i) => {
    const o = i ? haOpen : c + 0.3;
    const hi = Math.max(o, c) + 0.2 + rand() * 0.5;
    const lo = Math.min(o, c) - 0.2 - rand() * 0.5;
    haOpen = (o + c) / 2;
    return { o, c, hi, lo };
  });
  const min = Math.min(...candles.map((k) => k.lo)) - 0.3, max = Math.max(...candles.map((k) => k.hi)) + 0.3;
  const top = 50, bottom = 204, x0 = 52, step = 26;
  const y = (p) => bottom - ((p - min) / (max - min)) * (bottom - top);
  const xs = (i) => x0 + i * step;

  let ema = closes[0];
  const emaPts = closes.map((c, i) => {
    ema = i ? ema + 0.25 * (c - ema) : c;
    return `${xs(i).toFixed(1)},${y(ema).toFixed(1)}`;
  }).join(' ');

  const entry = 16, exit = 26;
  let stop = Math.min(candles[entry - 1].lo, candles[entry].lo);
  let stopPath = `M${xs(entry) - 8},${y(stop).toFixed(1)}`;
  for (let i = entry + 1; i <= exit; i++) {
    stop = Math.max(stop, candles[i - 1].lo);
    stopPath += ` H${xs(i) - 8} V${y(stop).toFixed(1)}`;
  }
  stopPath += ` H${xs(exit) + 8}`;

  const reveal = xs(closes.length - 1) + 14 - 40;
  return banner({
    label: 'AlgoPilotX BTC: a live Heikin-Ashi candlestick chart draws itself, a long entry triggers on a 3-candle breakout, and a trailing stop follows price to the exit',
    tint: '#0E1F1A',
    defs: `<clipPath id="live"><rect x="40" y="40" width="${reveal}" height="180">
    <animate attributeName="width" dur="10s" repeatCount="indefinite" values="0;${reveal};${reveal}" keyTimes="0;0.72;1"/>
  </rect></clipPath>`,
    css: `
  ${appear('tag', 72)} .tag { animation: tag 10s infinite; }`,
    body: `
${[0.25, 0.5, 0.75].map((f) => `<line x1="40" x2="800" y1="${top + f * (bottom - top)}" y2="${top + f * (bottom - top)}" stroke="${C.grid}" stroke-dasharray="3 5"/>`).join('')}
<text x="40" y="32" class="mono" font-size="16" fill="${C.muted}">BTCUSDT-PERP · 5m · heikin-ashi</text>
<rect x="372" y="16" width="84" height="24" rx="12" fill="${C.green}" fill-opacity=".12" stroke="${C.green}" stroke-opacity=".4"/>
<text x="414" y="33" class="mono" font-size="13" fill="${C.green}" text-anchor="middle" letter-spacing="1.5">PAPER</text>
<g class="reveal" clip-path="url(#live)">
  ${candles.map((k, i) => {
    const col = k.c >= k.o ? C.green : C.red;
    const bt = y(Math.max(k.o, k.c)), bb = y(Math.min(k.o, k.c));
    return `<line x1="${xs(i)}" x2="${xs(i)}" y1="${y(k.hi).toFixed(1)}" y2="${y(k.lo).toFixed(1)}" stroke="${col}" stroke-width="1.5"/><rect x="${xs(i) - 7}" y="${bt.toFixed(1)}" width="14" height="${Math.max(bb - bt, 1.5).toFixed(1)}" rx="1.5" fill="${col}"/>`;
  }).join('')}
  <polyline points="${emaPts}" fill="none" stroke="${C.purple}" stroke-width="2" opacity=".9"/>
  <path d="${stopPath}" fill="none" stroke="${C.orange}" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="M${xs(entry)},${(y(candles[entry].lo) + 10).toFixed(1)} l-7 12 h14 z" fill="${C.green}"/>
  <text x="${xs(entry)}" y="${(y(candles[entry].lo) + 38).toFixed(1)}" class="mono" font-size="14" font-weight="700" fill="${C.green}" text-anchor="middle">LONG</text>
  <path d="M${xs(exit)},${(y(candles[exit].hi) - 10).toFixed(1)} l-7 -12 h14 z" fill="${C.orange}"/>
</g>
<g class="tag">
  <text x="${xs(exit) + 18}" y="${(y(candles[exit].hi) - 26).toFixed(1)}" class="mono" font-size="14" font-weight="700" fill="${C.orange}" text-anchor="end">EXIT · trailing stop</text>
</g>
<text x="40" y="228" class="mono" font-size="15" fill="${C.muted}"><tspan fill="${C.purple}">━</tspan> EMA(50)&#160;&#160;&#160;<tspan fill="${C.orange}">┅</tspan> trailing stop&#160;&#160;&#160;rust · live mark-price + order book</text>`,
  });
}

// ---------------------------------------------------------------- CTF-CyberPunk: neon grid, glitch

function ctfCyberpunk() {
  const horizon = 138, vx = 420;
  const verticals = Array.from({ length: 17 }, (_, i) => {
    const bx = -380 + i * 100;
    return `<line x1="${vx}" y1="${horizon}" x2="${bx}" y2="${H}" stroke="${C.pink}" stroke-opacity=".45" stroke-width="1.5"/>`;
  }).join('');
  const floor = Array.from({ length: 6 }, (_, i) =>
    `<line x1="0" x2="${W}" y1="${horizon}" y2="${horizon}" stroke="${C.pink}" stroke-width="1.5" class="floor" style="animation-delay:${(-i * 0.5).toFixed(1)}s"/>`).join('');
  const cmd = 'root@ctf:~# ./breach --level 7';
  return banner({
    label: 'CTF-CyberPunk: a neon synthwave grid scrolls toward the viewer while ACCESS GRANTED glitches in cyan and magenta',
    tint: '#1F0B2E',
    defs: `<linearGradient id="sun" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.yellow}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0D1117" stop-opacity="0"/><stop offset="1" stop-color="${C.pink}" stop-opacity=".18"/></linearGradient>
  <mask id="stripes"><rect width="${W}" height="${H}" fill="#fff"/>${[96, 108, 118, 127].map((sy, i) => `<rect x="0" y="${sy}" width="${W}" height="${2 + i}" fill="#000"/>`).join('')}</mask>
  ${typing('cmd', { x: 40, y: 18, h: 30, chars: cmd.length, charW: 10.2, dur: 9, end: 0.3 })}`,
    css: `
  .floor { animation: floor 3s cubic-bezier(.55,0,1,.45) infinite; }
  @keyframes floor { from { transform: translateY(0); opacity: 0; } 15% { opacity: .8; } to { transform: translateY(${H - horizon}px); opacity: .8; } }
  .gc { animation: gc 3.2s steps(1) infinite; } .gm { animation: gm 3.2s steps(1) infinite; }
  @keyframes gc { 0%, 86% { transform: translate(-2px, 0); } 88% { transform: translate(-9px, 2px); } 90% { transform: translate(6px, -2px); } 92% { transform: translate(-4px, 1px); } 94%, 100% { transform: translate(-2px, 0); } }
  @keyframes gm { 0%, 86% { transform: translate(2px, 0); } 88% { transform: translate(8px, -2px); } 90% { transform: translate(-7px, 2px); } 92% { transform: translate(5px, -1px); } 94%, 100% { transform: translate(2px, 0); } }
  .gw { animation: gw 3.2s steps(1) infinite; }
  @keyframes gw { 0%, 87% { opacity: 1; } 89% { opacity: .35; } 91% { opacity: 1; } 93% { opacity: .6; } 95%, 100% { opacity: 1; } }`,
    body: `
<rect width="${W}" height="${horizon}" fill="url(#sky)"/>
<circle cx="${vx}" cy="${horizon}" r="70" fill="url(#sun)" mask="url(#stripes)" opacity=".9"/>
<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="#12061C"/>
${verticals}
${floor}
<line x1="0" x2="${W}" y1="${horizon}" y2="${horizon}" stroke="${C.pink}" stroke-width="2"/>
<g class="sans" font-size="56" font-weight="900" text-anchor="middle" letter-spacing="3">
  <text x="${vx}" y="${horizon - 22}" fill="${C.cyan}" opacity=".85" class="gc">ACCESS GRANTED</text>
  <text x="${vx}" y="${horizon - 22}" fill="${C.pink}" opacity=".85" class="gm">ACCESS GRANTED</text>
  <text x="${vx}" y="${horizon - 22}" fill="#FFFFFF" class="gw">ACCESS GRANTED</text>
</g>
<text x="40" y="40" class="mono reveal" font-size="17" fill="${C.green}" clip-path="url(#cmd)">${esc(cmd)}</text>`,
  });
}

// ---------------------------------------------------------------- BotTrainer: voice → intent JSON

function bottrainer() {
  const rand = rng(11);
  const bars = Array.from({ length: 20 }, (_, i) => {
    const h = 16 + rand() * 56;
    return `<rect x="${118 + i * 11}" y="${130 - h / 2}" width="6" height="${h.toFixed(1)}" rx="3" fill="url(#wave)" class="eq" style="animation-delay:${(-rand() * 1.2).toFixed(2)}s;animation-duration:${(0.8 + rand() * 0.7).toFixed(2)}s"/>`;
  }).join('');
  const said = '"book a flight to goa"';
  const json = [
    ['{', 0], ['  "intent": "book_flight",', 1], ['  "entities": {"city":"Goa"},', 1], ['  "confidence": 0.97', 1], ['}', 0],
  ];
  const at = [40, 48, 56, 64, 70];
  const color = (line) => line
    .replace(/("[^"]+")(:)/g, `<tspan fill="${C.blue}">$1</tspan>$2`)
    .replace(/: ("[^"]+")/g, `: <tspan fill="${C.green}">$1</tspan>`)
    .replace(/: (0\.\d+)/, `: <tspan fill="${C.orange}">$1</tspan>`);
  return banner({
    label: 'BotTrainer: spoken audio becomes a waveform, Whisper transcribes it, Llama-3 classifies it, and structured intent JSON appears',
    tint: '#16122A',
    defs: `<linearGradient id="wave" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
  ${typing('said', { x: 110, y: 44, h: 30, chars: said.length, charW: 10.8, dur: 8, start: 0.04, end: 0.32 })}`,
    css: `
  .eq { transform-box: fill-box; transform-origin: center; animation: eq 1s ease-in-out infinite alternate; }
  @keyframes eq { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
  .flow { stroke-dasharray: 4 10; animation: flow 1s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -14; } }
  ${json.map((_, i) => appear(`j${i}`, at[i])).join('\n  ')}
  ${json.map((_, i) => `.j${i} { animation: j${i} 8s infinite; }`).join(' ')}`,
    body: `
<g transform="translate(60 98)" fill="none" stroke="${C.text}" stroke-width="3" stroke-linecap="round">
  <rect x="0" y="0" width="24" height="42" rx="12" fill="${C.text}" fill-opacity=".12"/>
  <path d="M-8 26 a20 20 0 0 0 40 0 M12 46 v12 M2 58 h20"/>
</g>
<text x="110" y="66" class="mono reveal" font-size="18" fill="${C.muted}" clip-path="url(#said)">${esc(said)}</text>
${bars}
<text x="118" y="214" class="mono" font-size="15" fill="${C.muted}">voice or text input</text>
<path d="M352 130 H452" stroke="${C.purple}" stroke-width="2.5" class="flow" fill="none"/>
<path d="M448 123 l8 7 -8 7" stroke="${C.purple}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="402" y="108" class="mono" font-size="15" fill="${C.muted}" text-anchor="middle">whisper</text>
<text x="402" y="160" class="mono" font-size="15" fill="${C.muted}" text-anchor="middle">llama-3</text>
<rect x="470" y="40" width="340" height="168" rx="12" fill="${C.panel}" fill-opacity=".75" stroke="${C.border}"/>
${json.map(([line], i) => `<text x="488" y="${76 + i * 28}" class="mono j${i}" font-size="17" fill="${C.text}">${keep(color(esc(line).replace(/&quot;/g, '"')))}</text>`).join('\n')}`,
  });
}

const BANNERS = { astra, forensics, phishguard, algopilot, 'ctf-cyberpunk': ctfCyberpunk, bottrainer };

await mkdir('assets/projects', { recursive: true });
for (const [name, make] of Object.entries(BANNERS)) {
  await writeFile(`assets/projects/${name}.svg`, make());
  console.log(`assets/projects/${name}.svg`);
}

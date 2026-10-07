// Icon tiles for tools skillicons.dev doesn't cover, drawn to match its tiles exactly
// (48px high, #242938 rounded square, 8px gap) so they sit seamlessly after a skillicons strip.
//
//   node scripts/stack-icons.mjs        → assets/stack/*.svg   (run once, then commit)
//
// Logos come from Simple Icons (CC0), pinned for reproducible output.

import { mkdir, writeFile } from 'node:fs/promises';

const SIMPLE_ICONS = 'https://cdn.jsdelivr.net/npm/simple-icons@16.34.0/icons';
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;

// 256-unit tile like skillicons, plus 44 units of left gap (skillicons spaces tiles 300 apart).
const tile = (title, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="56.25" height="48" viewBox="-44 0 300 256" role="img" aria-label="${title}">
<title>${title}</title>
<rect width="256" height="256" rx="60" fill="#242938"/>
${inner}
</svg>
`;

async function simpleIcon(slug) {
  const svg = await (await fetch(`${SIMPLE_ICONS}/${slug}.svg`)).text();
  const d = svg.match(/<path d="([^"]+)"/)?.[1];
  if (!d) throw new Error(`no path for ${slug}`);
  return d;
}

// Simple Icons are 24×24; scale to a 150-unit glyph centred in the tile.
const glyph = (d, color) => `<path transform="translate(53 53) scale(6.25)" fill="${color}" d="${d}"/>`;

const ICONS = {
  langchain: { title: 'LangChain · LangGraph', slug: 'langchain', color: '#FFFFFF' },
  huggingface: { title: 'Hugging Face', slug: 'huggingface', color: '#FFD21E' },
  llama: { title: 'Llama 3 (Meta)', slug: 'meta', color: '#0081FB' },
  helm: { title: 'Helm', slug: 'helm', color: '#FFFFFF' },
  celery: { title: 'Celery', slug: 'celery', color: '#B6DE64' },
  gitops: { title: 'GitOps', slug: 'git', color: '#F05032' },
  // No Simple Icons entry for these: hand-drawn marks.
  whisper: {
    title: 'Whisper',
    inner: `${[34, 62, 96, 70, 112, 80, 50, 88, 40].map((h, i) => `<rect x="${52 + i * 18}" y="${110 - h / 2}" width="10" height="${h}" rx="5" fill="${i % 2 ? '#A371F7' : '#58A6FF'}"/>`).join('')}
<text x="128" y="206" font-family="${FONT}" font-size="40" font-weight="700" fill="#E6EDF3" text-anchor="middle">whisper</text>`,
  },
  chromadb: {
    title: 'ChromaDB',
    inner: `<circle cx="100" cy="128" r="58" fill="#FFDE2D"/><circle cx="156" cy="128" r="58" fill="#327EFF"/>
<path d="M128 77.3a58 58 0 0 1 0 101.4a58 58 0 0 1 0-101.4z" fill="#FF6446"/>`,
  },
  prophet: {
    title: 'Prophet',
    inner: `<path d="M52 164 L86 140 L112 150 L142 112" fill="none" stroke="#58A6FF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M142 112 L170 98 L204 70" fill="none" stroke="#A371F7" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 20"/>
<text x="128" y="214" font-family="${FONT}" font-size="40" font-weight="700" fill="#E6EDF3" text-anchor="middle">prophet</text>`,
  },
  xgboost: {
    title: 'XGBoost',
    inner: `<text x="128" y="140" font-family="${FONT}" font-size="92" font-weight="800" fill="#4FB5E6" text-anchor="middle" letter-spacing="-3">XGB</text>
<text x="128" y="190" font-family="${FONT}" font-size="40" font-weight="600" fill="#E6EDF3" text-anchor="middle">oost</text>`,
  },
};

await mkdir('assets/stack', { recursive: true });
for (const [name, icon] of Object.entries(ICONS)) {
  const inner = icon.inner ?? glyph(await simpleIcon(icon.slug), icon.color);
  await writeFile(`assets/stack/${name}.svg`, tile(icon.title, inner));
  console.log(`assets/stack/${name}.svg`);
}

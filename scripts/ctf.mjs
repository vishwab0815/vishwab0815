// Capture-the-flag hidden in the profile.
//
// The flag lives only in the CTF_FLAG Actions secret. Each build hides three encoded fragments:
//   1. base64, in a pod the cluster card never displays
//   2. ROT13, in the dark-mode status card only
//   3. hex, in security.txt on the output branch
// Solvers never post the flag: they submit sha256("<flag>:<username>"), which is useless to anyone else.
//
//   node scripts/ctf.mjs verify    (run by .github/workflows/ctf.yml on new issues)

import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { rest } from './lib/github.mjs';

export const rot13 = (s) => s.replace(/[a-z]/gi, (c) => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
});

export function splitFlag(flag) {
  const a = Math.ceil(flag.length / 3), b = Math.ceil((2 * flag.length) / 3);
  return [flag.slice(0, a), flag.slice(a, b), flag.slice(b)];
}

export function fragments(flag) {
  const [p1, p2, p3] = splitFlag(flag);
  return {
    pod: Buffer.from(`fragment 1/3 = "${p1}" | next: every status page has a dark side`).toString('base64'),
    status: rot13(`fragment 2/3 = "${p2}" | next: researchers always read security.txt, and this one sits beside the other generated assets`),
    security: Buffer.from(`fragment 3/3 = "${p3}" | assemble 1+2+3, then submit sha256("<flag>:<your github username in lowercase>")`).toString('hex'),
  };
}

export const proofFor = (flag, login) => createHash('sha256').update(`${flag}:${login.toLowerCase()}`).digest('hex');

export function securityTxt({ email, canonical, fragment, now }) {
  const expires = new Date(now + 365 * 86400e3).toISOString().replace(/\.\d+Z$/, 'Z');
  return [
    `Contact: mailto:${email}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    `Canonical: ${canonical}`,
    ...(fragment ? ['', '# Hello, researcher. You were expected.', `# ${fragment}`] : []),
    '',
  ].join('\n');
}

const PROOF = /###\s*Proof of flag\s+([0-9a-f]{64})\b/i;

export function evaluate({ body, login, flag }) {
  if (!flag) return 'offline';
  const m = (body ?? '').match(PROOF);
  if (!m) return 'malformed';
  const got = Buffer.from(m[1].toLowerCase());
  const want = Buffer.from(proofFor(flag, login));
  return timingSafeEqual(got, want) ? 'solved' : 'wrong';
}

const REPLIES = {
  solved: (login) => `### 🏁 Flag captured!\n\nNice work, @${login}. Your proof checks out and you're on the **Hall of Fame**; the profile rebuilds in a minute or two.\n\nPlease don't share the fragments; let others enjoy the hunt.`,
  wrong: () => `### ❌ Not quite\n\nThat proof doesn't match. Common slips:\n\n- the flag must include its wrapper, e.g. \`vishwa{...}\`\n- hash \`<flag>:<username>\` with your username in **lowercase**\n- no trailing newline: use \`printf '%s'\`, not \`echo\`\n\nOpen a new submission whenever you're ready.`,
  malformed: () => `### 🤔 No proof found\n\nPaste a 64-character SHA-256 hex digest into the **Proof of flag** field. Never paste the flag itself: issues are public.`,
  offline: () => `### ⏳ The CTF isn't live yet\n\nCheck back soon.`,
};

async function verify() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_EVENT_PATH, CTF_FLAG } = process.env;
  const { issue } = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'));
  const login = issue.user.login;
  const result = evaluate({ body: issue.body, login, flag: CTF_FLAG?.trim() });
  const api = (method, path, body, opts) => rest(token, method, `/repos/${repo}${path}`, body, opts);

  const label = { solved: ['ctf-solved', '3FB950'], wrong: ['ctf-wrong', 'F85149'] }[result];
  if (label) {
    await api('POST', '/labels', { name: label[0], color: label[1] }, { allow: [422] }); // 422: already exists
    await api('POST', `/issues/${issue.number}/labels`, { labels: [label[0]] });
  }
  await api('POST', `/issues/${issue.number}/comments`, { body: REPLIES[result](login) });
  await api('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: result === 'solved' ? 'completed' : 'not_planned' });
  if (result === 'solved') await api('POST', '/actions/workflows/profile.yml/dispatches', { ref: 'main' });
  console.log(`issue #${issue.number} by ${login}: ${result}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === 'verify') {
  await verify();
}

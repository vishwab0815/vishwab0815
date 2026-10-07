import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rot13, splitFlag, fragments, proofFor, evaluate, securityTxt } from '../ctf.mjs';

const FLAG = 'vishwa{s3lf_h34l1ng_pr0f1l3_7c2e}';
const body = (proof) => `### Proof of flag\n\n${proof}\n`;

test('rot13 is its own inverse and leaves non-letters alone', () => {
  const s = 'Hello, vishwa{s3lf_h34l1ng}!';
  assert.equal(rot13(rot13(s)), s);
  assert.equal(rot13('abc XYZ 123_{}'), 'nop KLM 123_{}');
});

test('flag splits into three parts that join back', () => {
  for (const f of [FLAG, 'abc', 'abcd', 'vishwa{x}']) assert.equal(splitFlag(f).join(''), f);
});

test('each fragment decodes to its part of the flag', () => {
  const f = fragments(FLAG);
  const parts = [
    Buffer.from(f.pod, 'base64').toString(),
    rot13(f.status),
    Buffer.from(f.security, 'hex').toString(),
  ].map((s) => s.match(/= "([^"]*)"/)[1]);
  assert.equal(parts.join(''), FLAG);
  assert.ok(!f.pod.includes('vishwa') && !f.status.includes('vishwa') && !f.security.includes('vishwa'));
});

test('proofs are tied to the solver and case-insensitive on username', () => {
  const proof = proofFor(FLAG, 'Octocat');
  assert.equal(proof, proofFor(FLAG, 'octocat'));
  assert.equal(evaluate({ body: body(proof), login: 'OctoCat', flag: FLAG }), 'solved');
  assert.equal(evaluate({ body: body(proof.toUpperCase()), login: 'octocat', flag: FLAG }), 'solved');
  assert.equal(evaluate({ body: body(proof), login: 'someone-else', flag: FLAG }), 'wrong');
});

test('bad submissions are classified', () => {
  assert.equal(evaluate({ body: body('a'.repeat(64)), login: 'x', flag: FLAG }), 'wrong');
  assert.equal(evaluate({ body: body(FLAG), login: 'x', flag: FLAG }), 'malformed');
  assert.equal(evaluate({ body: body('a'.repeat(65)), login: 'x', flag: FLAG }), 'malformed');
  assert.equal(evaluate({ body: null, login: 'x', flag: FLAG }), 'malformed');
  assert.equal(evaluate({ body: body('a'.repeat(64)), login: 'x', flag: undefined }), 'offline');
});

test('security.txt carries fragment 3 only when the CTF is live', () => {
  const live = securityTxt({ email: 'a@b.c', canonical: 'https://x/security.txt', fragment: 'abcd', now: 0 });
  assert.match(live, /^Contact: mailto:a@b\.c$/m);
  assert.match(live, /^Expires: 1971-01-01T00:00:00Z$/m);
  assert.match(live, /^# abcd$/m);
  assert.doesNotMatch(securityTxt({ email: 'a@b.c', canonical: 'x', fragment: null, now: 0 }), /#/);
});

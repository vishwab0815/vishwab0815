const HEADERS = { 'User-Agent': 'vishwab0815-profile', Accept: 'application/vnd.github+json' };

export async function graphql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...HEADERS, Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GraphQL ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

// REST call; resolves to parsed JSON (or null for empty bodies). Throws on non-2xx unless `allow` lists the status.
export async function rest(token, method, path, body, { allow = [] } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { ...HEADERS, Authorization: `bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !allow.includes(res.status)) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Everything the cards need from GitHub, normalized into one plain object.

import { graphql } from './lib/github.mjs';

const DAY = 86400e3;

const PROFILE_QUERY = `query($login: String!, $since8w: GitTimestamp!, $since7d: GitTimestamp!) {
  user(login: $login) {
    login name createdAt
    followers { totalCount }
    pullRequests { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      nodes {
        name isArchived createdAt pushedAt stargazerCount
        primaryLanguage { name color }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } }
        defaultBranchRef { target { ... on Commit {
          weeks: history(first: 100, since: $since8w) { nodes { committedDate } }
          recent: history(first: 1, since: $since7d) { totalCount }
          statusCheckRollup { state }
        } } }
      }
    }
  }
}`;

const CALENDAR_QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

export async function fetchGitHub({ login, token, now }) {
  const iso = (ms) => new Date(ms).toISOString();
  const { user } = await graphql(token, PROFILE_QUERY, {
    login, since8w: iso(now - 56 * DAY), since7d: iso(now - 7 * DAY),
  });
  if (!user) throw new Error(`User ${login} not found`);

  // contributionsCollection spans at most one year, so walk calendar years since signup.
  const days = new Map();
  let commitsThisYear = 0;
  const thisYear = new Date(now).getUTCFullYear();
  for (let year = new Date(user.createdAt).getUTCFullYear(); year <= thisYear; year++) {
    const from = Math.max(Date.UTC(year, 0, 1), Date.parse(user.createdAt));
    const to = Math.min(Date.UTC(year, 11, 31, 23, 59, 59), now);
    const { user: u } = await graphql(token, CALENDAR_QUERY, { login, from: iso(from), to: iso(to) });
    const cc = u.contributionsCollection;
    if (year === thisYear) commitsThisYear = cc.totalCommitContributions;
    for (const w of cc.contributionCalendar.weeks)
      for (const d of w.contributionDays) days.set(d.date, d.contributionCount);
  }

  return {
    login: user.login,
    name: user.name || user.login,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    pullRequests: user.pullRequests.totalCount,
    publicRepos: user.repositories.totalCount,
    commitsThisYear,
    repos: user.repositories.nodes.map((r) => {
      const head = r.defaultBranchRef?.target;
      return {
        name: r.name,
        stars: r.stargazerCount,
        isArchived: r.isArchived,
        createdAt: r.createdAt,
        pushedAt: r.pushedAt,
        primaryLanguage: r.primaryLanguage,
        languages: r.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
        commitDates: head?.weeks?.nodes.map((n) => n.committedDate) ?? [],
        commits7d: head?.recent?.totalCount ?? 0,
        ciState: head?.statusCheckRollup?.state ?? null,
      };
    }),
    days: [...days].map(([date, count]) => ({ date, count })),
  };
}

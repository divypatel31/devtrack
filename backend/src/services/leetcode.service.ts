import { env } from '../config/env';

export interface LeetCodeVerificationResult {
  username: string;
  solvedTodayCount: number;
  solvedTitles: string[];
}

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

const RECENT_AC_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
    }
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

/**
 * Queries LeetCode GraphQL API for recent Accepted (AC) submissions
 * and counts unique problems solved on targetDateStr (YYYY-MM-DD).
 * Deterministic "mock_lc_" prefix is strictly restricted to NODE_ENV === 'test'.
 */
export async function verifyLeetCodeSubmissionsForDate(
  username: string,
  targetDateStr: string,
  timezoneOffsetMinutes = 330
): Promise<LeetCodeVerificationResult> {
  const cleanUser = username.trim();

  if (!USERNAME_REGEX.test(cleanUser)) {
    throw new Error('Invalid LeetCode username format.');
  }

  if (cleanUser.startsWith('mock_lc_')) {
    if (env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new Error('Mock LeetCode usernames are not permitted outside test environments.');
    }
    const suffix = cleanUser.replace('mock_lc_', '');
    if (suffix === 'error') {
      throw new Error('Simulated LeetCode upstream error.');
    }
    const count = Math.max(0, Number(suffix) || 0);
    const titles = Array.from({ length: count }, (_, i) => `Problem #${i + 1}`);
    return {
      username: cleanUser,
      solvedTodayCount: count,
      solvedTitles: titles,
    };
  }

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com',
    },
    body: JSON.stringify({
      query: RECENT_AC_QUERY,
      variables: { username: cleanUser, limit: 25 },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode API returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      matchedUser?: { username: string } | null;
      recentAcSubmissionList?: Array<{
        title: string;
        titleSlug: string;
        timestamp: string;
      }>;
    };
  };

  if (!payload.data?.matchedUser) {
    throw new Error(`LeetCode user "${cleanUser}" not found.`);
  }

  const submissions = payload.data.recentAcSubmissionList || [];
  const uniqueToday = new Map<string, string>();

  for (const sub of submissions) {
    const utcMs = Number(sub.timestamp) * 1000;
    const localDate = new Date(utcMs + timezoneOffsetMinutes * 60 * 1000);
    const subDateStr = localDate.toISOString().split('T')[0];

    if (subDateStr === targetDateStr) {
      uniqueToday.set(sub.titleSlug, sub.title);
    }
  }

  return {
    username: cleanUser,
    solvedTodayCount: uniqueToday.size,
    solvedTitles: Array.from(uniqueToday.values()),
  };
}
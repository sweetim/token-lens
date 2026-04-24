import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectTokens, DayTokens } from "./types.js";

const DB_PATH = join(homedir(), ".local", "share", "kilo", "kilo.db");

const PROJECT_QUERY = `
SELECT
  REPLACE(p.worktree, '${homedir()}/projects/', '') AS project,
  SUM(CAST(json_extract(part.data, '$.tokens.total') AS INTEGER)) AS total_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.input') AS INTEGER)) AS input_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.output') AS INTEGER)) AS output_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.reasoning') AS INTEGER)) AS reasoning_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.cache.read') AS INTEGER)) AS cache_read,
  SUM(CAST(json_extract(part.data, '$.tokens.cache.write') AS INTEGER)) AS cache_write,
  ROUND(SUM(CAST(json_extract(part.data, '$.cost') AS REAL)), 2) AS total_cost,
  COUNT(*) AS steps,
  COUNT(DISTINCT s.id) AS sessions,
  (MAX(part.time_created) - MIN(part.time_created)) AS duration
FROM part
JOIN message ON message.id = part.message_id
JOIN session s ON s.id = message.session_id
JOIN project p ON p.id = s.project_id
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY p.worktree
ORDER BY total_tokens DESC;
`;

const DAY_QUERY = `
SELECT
  date(part.time_created / 1000, 'unixepoch') AS day,
  SUM(CAST(json_extract(part.data, '$.tokens.total') AS INTEGER)) AS total_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.input') AS INTEGER)) AS input_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.output') AS INTEGER)) AS output_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.reasoning') AS INTEGER)) AS reasoning_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.cache.read') AS INTEGER)) AS cache_read,
  SUM(CAST(json_extract(part.data, '$.tokens.cache.write') AS INTEGER)) AS cache_write,
  ROUND(SUM(CAST(json_extract(part.data, '$.cost') AS REAL)), 2) AS total_cost,
  COUNT(*) AS steps,
  COUNT(DISTINCT s.id) AS sessions
FROM part
JOIN message ON message.id = part.message_id
JOIN session s ON s.id = message.session_id
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY day
ORDER BY day DESC;
`;

function execQuery<T>(query: string, mapRow: (r: Record<string, unknown>) => T): Promise<T[]> {
  return new Promise((resolve, reject) => {
    execFile("sqlite3", [DB_PATH, "-json", query], { timeout: 10000 }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stdout.trim()) {
        resolve([]);
        return;
      }
      try {
        const rows = JSON.parse(stdout) as Array<Record<string, unknown>>;
        resolve(rows.map(mapRow));
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function queryProjectTokens(): Promise<ProjectTokens[]> {
  return execQuery(PROJECT_QUERY, (r) => ({
    project: String(r.project ?? ""),
    totalTokens: Number(r.total_tokens) || 0,
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
    reasoningTokens: Number(r.reasoning_tokens) || 0,
    cacheRead: Number(r.cache_read) || 0,
    cacheWrite: Number(r.cache_write) || 0,
    totalCost: Number(r.total_cost) || 0,
    steps: Number(r.steps) || 0,
    sessions: Number(r.sessions) || 0,
    duration: Number(r.duration) || 0,
  }));
}

function queryDayTokens(): Promise<DayTokens[]> {
  return execQuery(DAY_QUERY, (r) => ({
    day: String(r.day ?? ""),
    totalTokens: Number(r.total_tokens) || 0,
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
    reasoningTokens: Number(r.reasoning_tokens) || 0,
    cacheRead: Number(r.cache_read) || 0,
    cacheWrite: Number(r.cache_write) || 0,
    totalCost: Number(r.total_cost) || 0,
    steps: Number(r.steps) || 0,
    sessions: Number(r.sessions) || 0,
  }));
}

export { queryProjectTokens, queryDayTokens };

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import initSqlJs from "sql.js";
import type { ProjectTokens, DayTokens, ProjectDayTokens } from "./types.js";

const DB_PATH = join(homedir(), ".local", "share", "kilo", "kilo.db");

const tzOffsetMinutes = -new Date().getTimezoneOffset();
const tzHours = Math.trunc(tzOffsetMinutes / 60);
const tzMins = Math.abs(tzOffsetMinutes % 60);
const tzSign = tzHours >= 0 ? "+" : "-";
const TZ_MODIFIER = `'unixepoch', '${tzSign}${Math.abs(tzHours)} hours'${tzMins ? `, '${tzSign}${tzMins} minutes'` : ""}`;

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
  date(part.time_created / 1000, ${TZ_MODIFIER}) AS day,
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
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY day
ORDER BY day DESC;
`;

const PROJECT_DAY_QUERY = `
SELECT
  REPLACE(p.worktree, '${homedir()}/projects/', '') AS project,
  date(part.time_created / 1000, ${TZ_MODIFIER}) AS day,
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
GROUP BY p.worktree, day
ORDER BY day DESC, total_tokens DESC;
`;

let sqlModule: SqlJsStatic | null = null;
type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;

async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) =>
        join(__dirname, file),
    });
  }
  return sqlModule;
}

async function execQuery<T>(query: string, mapRow: (r: Record<string, unknown>) => T): Promise<T[]> {
  const SQL = await getSqlModule();
  const buf = readFileSync(DB_PATH);
  const db = new SQL.Database(buf);
  try {
    const result = db.exec(query);
    if (result.length === 0) {
      return [];
    }
    const columns = result[0].columns;
    return result[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return mapRow(obj);
    });
  } finally {
    db.close();
  }
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
    duration: Number(r.duration) || 0,
  }));
}

function queryProjectDayTokens(): Promise<ProjectDayTokens[]> {
  return execQuery(PROJECT_DAY_QUERY, (r) => ({
    project: String(r.project ?? ""),
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
    duration: Number(r.duration) || 0,
  }));
}

export { queryProjectTokens, queryDayTokens, queryProjectDayTokens };

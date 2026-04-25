import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import initSqlJs from "sql.js";
import type { ProjectTokens, DayTokens, ProjectDayTokens, ModelCost, ModelUsage } from "./types.js";

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

const MODEL_COST_QUERY = `
SELECT
  REPLACE(p.worktree, '${homedir()}/projects/', '') AS project,
  json_extract(message.data, '$.providerID') AS provider,
  json_extract(message.data, '$.modelID') AS model,
  SUM(CAST(json_extract(part.data, '$.tokens.input') AS INTEGER)) AS input_tokens,
  SUM(CAST(json_extract(part.data, '$.tokens.output') AS INTEGER)) AS output_tokens
FROM part
JOIN message ON message.id = part.message_id
JOIN session s ON s.id = message.session_id
JOIN project p ON p.id = s.project_id
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY p.worktree, provider, model
ORDER BY input_tokens DESC;
`;

const PROJECT_MODEL_QUERY = `
SELECT
  REPLACE(p.worktree, '${homedir()}/projects/', '') AS project,
  json_extract(message.data, '$.providerID') AS provider,
  json_extract(message.data, '$.modelID') AS model,
  COUNT(*) AS steps,
  SUM(CAST(json_extract(part.data, '$.tokens.total') AS INTEGER)) AS total_tokens,
  ROUND(SUM(CAST(json_extract(part.data, '$.cost') AS REAL)), 4) AS total_cost
FROM part
JOIN message ON message.id = part.message_id
JOIN session s ON s.id = message.session_id
JOIN project p ON p.id = s.project_id
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY p.worktree, provider, model
ORDER BY total_cost DESC;
`;

const DAY_MODEL_QUERY = `
SELECT
  date(part.time_created / 1000, ${TZ_MODIFIER}) AS day,
  json_extract(message.data, '$.providerID') AS provider,
  json_extract(message.data, '$.modelID') AS model,
  COUNT(*) AS steps,
  SUM(CAST(json_extract(part.data, '$.tokens.total') AS INTEGER)) AS total_tokens,
  ROUND(SUM(CAST(json_extract(part.data, '$.cost') AS REAL)), 4) AS total_cost
FROM part
JOIN message ON message.id = part.message_id
JOIN session s ON s.id = message.session_id
WHERE json_extract(part.data, '$.type') = 'step-finish'
GROUP BY day, provider, model
ORDER BY total_cost DESC;
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
    models: [],
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
    models: [],
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

function queryModelCosts(): Promise<ModelCost[]> {
  return execQuery(MODEL_COST_QUERY, (r) => ({
    project: String(r.project ?? ""),
    provider: String(r.provider ?? ""),
    model: String(r.model ?? ""),
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
  }));
}

type ProjectModelRow = {
  project: string;
  provider: string;
  model: string;
  steps: number;
  totalTokens: number;
  totalCost: number;
};

type DayModelRow = {
  day: string;
  provider: string;
  model: string;
  steps: number;
  totalTokens: number;
  totalCost: number;
};

function queryProjectModels(): Promise<ProjectModelRow[]> {
  return execQuery(PROJECT_MODEL_QUERY, (r) => ({
    project: String(r.project ?? ""),
    provider: String(r.provider ?? ""),
    model: String(r.model ?? ""),
    steps: Number(r.steps) || 0,
    totalTokens: Number(r.total_tokens) || 0,
    totalCost: Number(r.total_cost) || 0,
  }));
}

function queryDayModels(): Promise<DayModelRow[]> {
  return execQuery(DAY_MODEL_QUERY, (r) => ({
    day: String(r.day ?? ""),
    provider: String(r.provider ?? ""),
    model: String(r.model ?? ""),
    steps: Number(r.steps) || 0,
    totalTokens: Number(r.total_tokens) || 0,
    totalCost: Number(r.total_cost) || 0,
  }));
}

export { queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels };

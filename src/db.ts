import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import dayjs from "dayjs";
import { desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import initSqlJs from "sql.js";
import type { DayTokens, ModelCost, ProjectDayTokens, ProjectTokens } from "./types.js";

const DB_PATH = join(homedir(), ".local", "share", "kilo", "kilo.db");
const PROJECT_ROOT_PREFIX = `${homedir()}/projects/`;

const tzOffsetMinutes = -dayjs().utcOffset();
const tzHours = Math.trunc(tzOffsetMinutes / 60);
const tzMins = Math.abs(tzOffsetMinutes % 60);
const tzSign = tzHours >= 0 ? "+" : "-";
const TZ_MODIFIER = `'unixepoch', '${tzSign}${Math.abs(tzHours)} hours'${tzMins ? `, '${tzSign}${tzMins} minutes'` : ""}`;

const partTable = sqliteTable("part", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});

const messageTable = sqliteTable("message", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});

const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
});

const projectTable = sqliteTable("project", {
  id: text("id").primaryKey(),
  worktree: text("worktree").notNull(),
});

const stepType = sql<string>`json_extract(${partTable.data}, '$.type')`;
const totalTokensValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.total') AS INTEGER)`;
const inputTokensValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.input') AS INTEGER)`;
const outputTokensValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.output') AS INTEGER)`;
const reasoningTokensValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.reasoning') AS INTEGER)`;
const cacheReadValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.cache.read') AS INTEGER)`;
const cacheWriteValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.tokens.cache.write') AS INTEGER)`;
const costValue = sql<number | null>`CAST(json_extract(${partTable.data}, '$.cost') AS REAL)`;
const providerValue = sql<string>`json_extract(${messageTable.data}, '$.providerID')`;
const modelValue = sql<string>`json_extract(${messageTable.data}, '$.modelID')`;
const localDayValue = sql<string>`date(${partTable.timeCreated} / 1000, ${sql.raw(TZ_MODIFIER)})`;
const projectNameValue = sql<string>`REPLACE(${projectTable.worktree}, ${PROJECT_ROOT_PREFIX}, '')`;
const stepFinishCondition = sql`${stepType} = 'step-finish'`;

let sqlModule: SqlJsStatic | null = null;
type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;

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

async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) =>
        join(__dirname, file),
    });
  }
  return sqlModule;
}

function toNumber(value: unknown): number {
  return Number(value) || 0;
}

async function withDatabase<T>(callback: (database: ReturnType<typeof drizzle>) => T): Promise<T> {
  const SQL = await getSqlModule();
  const databaseFile = readFileSync(DB_PATH);
  const client = new SQL.Database(databaseFile);
  const database = drizzle(client);
  try {
    return callback(database);
  } finally {
    client.close();
  }
}

async function queryProjectTokens(): Promise<ProjectTokens[]> {
  return withDatabase((database) => {
    const totalTokens = sql<number | null>`SUM(${totalTokensValue})`;
    const inputTokens = sql<number | null>`SUM(${inputTokensValue})`;
    const outputTokens = sql<number | null>`SUM(${outputTokensValue})`;
    const reasoningTokens = sql<number | null>`SUM(${reasoningTokensValue})`;
    const cacheRead = sql<number | null>`SUM(${cacheReadValue})`;
    const cacheWrite = sql<number | null>`SUM(${cacheWriteValue})`;
    const totalCost = sql<number | null>`ROUND(SUM(${costValue}), 2)`;
    const steps = sql<number>`COUNT(*)`;
    const sessions = sql<number>`COUNT(DISTINCT ${sessionTable.id})`;
    const duration = sql<number | null>`MAX(${partTable.timeCreated}) - MIN(${partTable.timeCreated})`;

    return database
      .select({
        project: projectNameValue.as("project"),
        totalTokens: totalTokens.as("total_tokens"),
        inputTokens: inputTokens.as("input_tokens"),
        outputTokens: outputTokens.as("output_tokens"),
        reasoningTokens: reasoningTokens.as("reasoning_tokens"),
        cacheRead: cacheRead.as("cache_read"),
        cacheWrite: cacheWrite.as("cache_write"),
        totalCost: totalCost.as("total_cost"),
        steps: steps.as("steps"),
        sessions: sessions.as("sessions"),
        duration: duration.as("duration"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .innerJoin(projectTable, sql`${projectTable.id} = ${sessionTable.projectId}`)
      .where(stepFinishCondition)
      .groupBy(projectTable.worktree)
      .orderBy(desc(totalTokens))
      .all()
      .map((row) => ({
        project: String(row.project ?? ""),
        totalTokens: toNumber(row.totalTokens),
        inputTokens: toNumber(row.inputTokens),
        outputTokens: toNumber(row.outputTokens),
        reasoningTokens: toNumber(row.reasoningTokens),
        cacheRead: toNumber(row.cacheRead),
        cacheWrite: toNumber(row.cacheWrite),
        totalCost: toNumber(row.totalCost),
        steps: toNumber(row.steps),
        sessions: toNumber(row.sessions),
        duration: toNumber(row.duration),
        models: [],
      }));
  });
}

async function queryDayTokens(): Promise<DayTokens[]> {
  return withDatabase((database) => {
    const totalTokens = sql<number | null>`SUM(${totalTokensValue})`;
    const inputTokens = sql<number | null>`SUM(${inputTokensValue})`;
    const outputTokens = sql<number | null>`SUM(${outputTokensValue})`;
    const reasoningTokens = sql<number | null>`SUM(${reasoningTokensValue})`;
    const cacheRead = sql<number | null>`SUM(${cacheReadValue})`;
    const cacheWrite = sql<number | null>`SUM(${cacheWriteValue})`;
    const totalCost = sql<number | null>`ROUND(SUM(${costValue}), 2)`;
    const steps = sql<number>`COUNT(*)`;
    const sessions = sql<number>`COUNT(DISTINCT ${sessionTable.id})`;
    const duration = sql<number | null>`MAX(${partTable.timeCreated}) - MIN(${partTable.timeCreated})`;

    return database
      .select({
        day: localDayValue.as("day"),
        totalTokens: totalTokens.as("total_tokens"),
        inputTokens: inputTokens.as("input_tokens"),
        outputTokens: outputTokens.as("output_tokens"),
        reasoningTokens: reasoningTokens.as("reasoning_tokens"),
        cacheRead: cacheRead.as("cache_read"),
        cacheWrite: cacheWrite.as("cache_write"),
        totalCost: totalCost.as("total_cost"),
        steps: steps.as("steps"),
        sessions: sessions.as("sessions"),
        duration: duration.as("duration"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .where(stepFinishCondition)
      .groupBy(localDayValue)
      .orderBy(desc(localDayValue))
      .all()
      .map((row) => ({
        day: String(row.day ?? ""),
        totalTokens: toNumber(row.totalTokens),
        inputTokens: toNumber(row.inputTokens),
        outputTokens: toNumber(row.outputTokens),
        reasoningTokens: toNumber(row.reasoningTokens),
        cacheRead: toNumber(row.cacheRead),
        cacheWrite: toNumber(row.cacheWrite),
        totalCost: toNumber(row.totalCost),
        steps: toNumber(row.steps),
        sessions: toNumber(row.sessions),
        duration: toNumber(row.duration),
        models: [],
      }));
  });
}

async function queryProjectDayTokens(): Promise<ProjectDayTokens[]> {
  return withDatabase((database) => {
    const totalTokens = sql<number | null>`SUM(${totalTokensValue})`;
    const inputTokens = sql<number | null>`SUM(${inputTokensValue})`;
    const outputTokens = sql<number | null>`SUM(${outputTokensValue})`;
    const reasoningTokens = sql<number | null>`SUM(${reasoningTokensValue})`;
    const cacheRead = sql<number | null>`SUM(${cacheReadValue})`;
    const cacheWrite = sql<number | null>`SUM(${cacheWriteValue})`;
    const totalCost = sql<number | null>`ROUND(SUM(${costValue}), 2)`;
    const steps = sql<number>`COUNT(*)`;
    const sessions = sql<number>`COUNT(DISTINCT ${sessionTable.id})`;
    const duration = sql<number | null>`MAX(${partTable.timeCreated}) - MIN(${partTable.timeCreated})`;

    return database
      .select({
        project: projectNameValue.as("project"),
        day: localDayValue.as("day"),
        totalTokens: totalTokens.as("total_tokens"),
        inputTokens: inputTokens.as("input_tokens"),
        outputTokens: outputTokens.as("output_tokens"),
        reasoningTokens: reasoningTokens.as("reasoning_tokens"),
        cacheRead: cacheRead.as("cache_read"),
        cacheWrite: cacheWrite.as("cache_write"),
        totalCost: totalCost.as("total_cost"),
        steps: steps.as("steps"),
        sessions: sessions.as("sessions"),
        duration: duration.as("duration"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .innerJoin(projectTable, sql`${projectTable.id} = ${sessionTable.projectId}`)
      .where(stepFinishCondition)
      .groupBy(projectTable.worktree, localDayValue)
      .orderBy(desc(localDayValue), desc(totalTokens))
      .all()
      .map((row) => ({
        project: String(row.project ?? ""),
        day: String(row.day ?? ""),
        totalTokens: toNumber(row.totalTokens),
        inputTokens: toNumber(row.inputTokens),
        outputTokens: toNumber(row.outputTokens),
        reasoningTokens: toNumber(row.reasoningTokens),
        cacheRead: toNumber(row.cacheRead),
        cacheWrite: toNumber(row.cacheWrite),
        totalCost: toNumber(row.totalCost),
        steps: toNumber(row.steps),
        sessions: toNumber(row.sessions),
        duration: toNumber(row.duration),
      }));
  });
}

async function queryModelCosts(): Promise<ModelCost[]> {
  return withDatabase((database) => {
    const inputTokens = sql<number | null>`SUM(${inputTokensValue})`;
    const outputTokens = sql<number | null>`SUM(${outputTokensValue})`;
    const reasoningTokens = sql<number | null>`SUM(${reasoningTokensValue})`;
    const cacheRead = sql<number | null>`SUM(${cacheReadValue})`;

    return database
      .select({
        project: projectNameValue.as("project"),
        provider: providerValue.as("provider"),
        model: modelValue.as("model"),
        inputTokens: inputTokens.as("input_tokens"),
        outputTokens: outputTokens.as("output_tokens"),
        reasoningTokens: reasoningTokens.as("reasoning_tokens"),
        cacheRead: cacheRead.as("cache_read"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .innerJoin(projectTable, sql`${projectTable.id} = ${sessionTable.projectId}`)
      .where(stepFinishCondition)
      .groupBy(projectTable.worktree, providerValue, modelValue)
      .orderBy(desc(inputTokens))
      .all()
      .map((row) => ({
        project: String(row.project ?? ""),
        provider: String(row.provider ?? ""),
        model: String(row.model ?? ""),
        inputTokens: toNumber(row.inputTokens),
        outputTokens: toNumber(row.outputTokens),
        reasoningTokens: toNumber(row.reasoningTokens),
        cacheRead: toNumber(row.cacheRead),
      }));
  });
}

async function queryProjectModels(): Promise<ProjectModelRow[]> {
  return withDatabase((database) => {
    const steps = sql<number>`COUNT(*)`;
    const totalTokens = sql<number | null>`SUM(${totalTokensValue})`;
    const totalCost = sql<number | null>`ROUND(SUM(${costValue}), 4)`;

    return database
      .select({
        project: projectNameValue.as("project"),
        provider: providerValue.as("provider"),
        model: modelValue.as("model"),
        steps: steps.as("steps"),
        totalTokens: totalTokens.as("total_tokens"),
        totalCost: totalCost.as("total_cost"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .innerJoin(projectTable, sql`${projectTable.id} = ${sessionTable.projectId}`)
      .where(stepFinishCondition)
      .groupBy(projectTable.worktree, providerValue, modelValue)
      .orderBy(desc(totalCost))
      .all()
      .map((row) => ({
        project: String(row.project ?? ""),
        provider: String(row.provider ?? ""),
        model: String(row.model ?? ""),
        steps: toNumber(row.steps),
        totalTokens: toNumber(row.totalTokens),
        totalCost: toNumber(row.totalCost),
      }));
  });
}

async function queryDayModels(): Promise<DayModelRow[]> {
  return withDatabase((database) => {
    const steps = sql<number>`COUNT(*)`;
    const totalTokens = sql<number | null>`SUM(${totalTokensValue})`;
    const totalCost = sql<number | null>`ROUND(SUM(${costValue}), 4)`;

    return database
      .select({
        day: localDayValue.as("day"),
        provider: providerValue.as("provider"),
        model: modelValue.as("model"),
        steps: steps.as("steps"),
        totalTokens: totalTokens.as("total_tokens"),
        totalCost: totalCost.as("total_cost"),
      })
      .from(partTable)
      .innerJoin(messageTable, sql`${messageTable.id} = ${partTable.messageId}`)
      .innerJoin(sessionTable, sql`${sessionTable.id} = ${messageTable.sessionId}`)
      .where(stepFinishCondition)
      .groupBy(localDayValue, providerValue, modelValue)
      .orderBy(desc(totalCost))
      .all()
      .map((row) => ({
        day: String(row.day ?? ""),
        provider: String(row.provider ?? ""),
        model: String(row.model ?? ""),
        steps: toNumber(row.steps),
        totalTokens: toNumber(row.totalTokens),
        totalCost: toNumber(row.totalCost),
      }));
  });
}

export { queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels };

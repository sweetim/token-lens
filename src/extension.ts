import * as vscode from "vscode";
import { closeDatabase, preloadSqlModule, setDatabasePath } from "@/db";
import { logger, formatLogMessage, setLogSink } from "@/logger";
import { TokenSidebarProvider } from "@/tokenSidebar";
import type { QuotaState, QuotaSummary } from "@/types";

type UsageDetail = { modelCode: string; usage: number };

type Limit = {
  type: string;
  unit: number;
  number: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
  percentage?: number;
  nextResetTime: number;
  usageDetails?: UsageDetail[];
};

type QuotaResponse = {
  code: number;
  data: {
    limits: Limit[];
    level: string;
  };
};

type QuotaFetchResult =
  | { type: "success"; data: QuotaResponse["data"]; quotaSummary: QuotaSummary }
  | { type: "missingApiKey" }
  | { type: "authError"; message: string }
  | { type: "rateLimited"; retryAfterMs?: number }
  | { type: "transientError"; message: string }
  | { type: "invalidResponse"; message: string };

const QUOTA_SNAPSHOT_STORAGE_KEY = "token-lens.quotaSnapshot";
const LEGACY_REFRESH_INTERVAL_STORAGE_KEY = "token-lens.refreshIntervalMinutes";
const SAVED_MODELS_STORAGE_KEY = "token-lens.savedModels";
const CONFIGURATION_SECTION = "token-lens";
const DEFAULT_REFRESH_INTERVAL_MINUTES = 5;
const TRANSIENT_RETRY_DELAYS_MS = [10000, 30000, 60000, 120000, 300000] as const;
const LOADING_QUOTA_STATE: QuotaState = {
  status: "loading",
  message: "Loading quota from z.ai.",
};

function formatResetTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) {
    return "due";
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatDurationCompact(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) {
    return "due";
  }
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) {
    return `${hours}h`;
  }
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "1m";
}

function formatDelay(delayMs: number): string {
  if (delayMs < 60000) {
    return `${Math.max(1, Math.round(delayMs / 1000))}s`;
  }

  const minutes = Math.floor(delayMs / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;
}

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) {
    return "just now";
  }

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function getStatusBackgroundColor(usedPct: number): vscode.ThemeColor | undefined {
  if (usedPct >= 80) {
    return new vscode.ThemeColor("statusBarItem.errorBackground");
  }
  if (usedPct >= 50) {
    return new vscode.ThemeColor("statusBarItem.warningBackground");
  }
  return undefined;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildQuotaSummary(data: QuotaResponse["data"]): QuotaSummary | undefined {
  const tokenLimit = data.limits.find((limit) => limit.type === "TOKENS_LIMIT");
  if (!tokenLimit) {
    return undefined;
  }

  const usedPercentage = finiteNumber(tokenLimit.percentage, 0);
  const limitTokens = finiteNumber(tokenLimit.number, 0);
  const usedTokens = finiteNumber(
    tokenLimit.usage,
    finiteNumber(tokenLimit.currentValue, limitTokens > 0 ? Math.round((limitTokens * usedPercentage) / 100) : 0),
  );
  const remainingTokens = finiteNumber(tokenLimit.remaining, Math.max(limitTokens - usedTokens, 0));
  const remainingPercentage = Math.max(0, Math.min(100, 100 - usedPercentage));

  return {
    usedTokens,
    limitTokens,
    remainingTokens,
    usedPercentage,
    remainingPercentage,
    nextResetTime: tokenLimit.nextResetTime,
    fetchedAt: Date.now(),
  };
}

function buildTooltip(quotaState: QuotaState): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString("", true);
  markdown.supportHtml = true;
  markdown.isTrusted = true;
  markdown.appendMarkdown(`<span style="font-size:13px;"><b>$(spark) Token Lens - zai</b></span>\n\n`);

  if (!quotaState.summary) {
    markdown.appendMarkdown(quotaState.message);
    return markdown;
  }

  const usedPct = quotaState.summary.usedPercentage;
  const gradientColors = [
    "#4ec9b0", "#5ec47a", "#7ebc4a", "#a0b030",
    "#c8a020", "#e08c18", "#e87020", "#f05828",
    "#f44040", "#f44767",
  ];
  const barFilled = Math.round((usedPct / 100) * 20);
  let bar = "";
  for (let index = 0; index < 20; index += 1) {
    const color = index < barFilled ? gradientColors[Math.floor(index / 2)] : "#555";
    bar += `<span style="color:${color};">█</span>`;
  }

  markdown.appendMarkdown(`<code style="font-size:10px;letter-spacing:-1px;">${bar}</code> **${usedPct.toFixed(0)}%**\n\n`);
  markdown.appendMarkdown(`---\n\n`);
  markdown.appendMarkdown(`$(clock) Resets **${formatDuration(quotaState.summary.nextResetTime)}**\n\n`);
  markdown.appendMarkdown(`<span style="color:var(--vscode-descriptionForeground);">${formatResetTime(quotaState.summary.nextResetTime)}</span>`);
  if (quotaState.message) {
    markdown.appendMarkdown(`\n\n---\n\n$(history) ${quotaState.message}`);
  }

  return markdown;
}

function isQuotaResponse(value: unknown): value is QuotaResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeResponse = value as { data?: { limits?: unknown } };
  return Array.isArray(maybeResponse.data?.limits);
}

function isQuotaSummary(value: unknown): value is QuotaSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeSummary = value as Record<string, unknown>;
  return isFiniteNumber(maybeSummary.usedTokens)
    && isFiniteNumber(maybeSummary.limitTokens)
    && isFiniteNumber(maybeSummary.remainingTokens)
    && isFiniteNumber(maybeSummary.usedPercentage)
    && isFiniteNumber(maybeSummary.remainingPercentage)
    && isFiniteNumber(maybeSummary.nextResetTime)
    && isFiniteNumber(maybeSummary.fetchedAt);
}

function parseRetryAfterMs(retryAfterHeader: string | undefined): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(retryAt - Date.now(), 1000);
}

function getRetryDelayMs(failureCount: number): number {
  return TRANSIENT_RETRY_DELAYS_MS[Math.min(failureCount - 1, TRANSIENT_RETRY_DELAYS_MS.length - 1)];
}

function getStatusBarCommand(quotaState: QuotaState): vscode.Command {
  if (quotaState.status === "missingApiKey" || quotaState.status === "authError") {
    return {
      command: "token-lens.setApiKey",
      title: "Set API Key",
    };
  }

  return {
    command: "token-lens.refresh",
    title: "Refresh",
  };
}

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshPromise: Promise<void> | undefined;
let secrets: vscode.SecretStorage;
let tokenSidebar: TokenSidebarProvider;
let extensionContext: vscode.ExtensionContext;
let quotaState: QuotaState = LOADING_QUOTA_STATE;
let persistedQuotaSummary: QuotaSummary | undefined;
let consecutiveTransientFailures = 0;

function getRefreshIntervalMinutes(): number {
  const configuredMinutes = vscode.workspace.getConfiguration(CONFIGURATION_SECTION).get<number>("refreshIntervalMinutes");
  if (typeof configuredMinutes === "number" && Number.isFinite(configuredMinutes) && configuredMinutes >= 1) {
    return configuredMinutes;
  }
  return DEFAULT_REFRESH_INTERVAL_MINUTES;
}

async function saveRefreshIntervalMinutes(minutes: number): Promise<void> {
  await vscode.workspace.getConfiguration(CONFIGURATION_SECTION).update("refreshIntervalMinutes", minutes, vscode.ConfigurationTarget.Global);
}

async function saveDatabasePathSetting(databasePath: string): Promise<void> {
  const trimmedPath = databasePath.trim();
  await vscode.workspace.getConfiguration(CONFIGURATION_SECTION).update("databasePath", trimmedPath || undefined, vscode.ConfigurationTarget.Global);
}

function applyDatabasePathConfiguration(): void {
  setDatabasePath(vscode.workspace.getConfiguration(CONFIGURATION_SECTION).get<string>("databasePath"));
}

async function migrateLegacyRefreshInterval(): Promise<void> {
  const legacyMinutes = extensionContext.globalState.get<number>(LEGACY_REFRESH_INTERVAL_STORAGE_KEY);
  if (typeof legacyMinutes !== "number") {
    return;
  }
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  if (configuration.inspect<number>("refreshIntervalMinutes")?.globalValue === undefined) {
    await configuration.update("refreshIntervalMinutes", legacyMinutes, vscode.ConfigurationTarget.Global);
  }
  await extensionContext.globalState.update(LEGACY_REFRESH_INTERVAL_STORAGE_KEY, undefined);
}

function getSavedModels(): string[] {
  return extensionContext.globalState.get<string[]>(SAVED_MODELS_STORAGE_KEY) ?? [];
}

async function saveSavedModels(savedModels: string[]): Promise<void> {
  await extensionContext.globalState.update(SAVED_MODELS_STORAGE_KEY, savedModels);
}

function getRefreshDelayMs(): number {
  return getRefreshIntervalMinutes() * 60 * 1000;
}

function getLastSuccessfulQuotaSummary(): QuotaSummary | undefined {
  return quotaState.summary ?? persistedQuotaSummary;
}

async function persistQuotaSummary(nextQuotaSummary: QuotaSummary | undefined): Promise<void> {
  persistedQuotaSummary = nextQuotaSummary;
  await extensionContext.globalState.update(QUOTA_SNAPSHOT_STORAGE_KEY, nextQuotaSummary);
}

function applyStatusBarState(nextQuotaState: QuotaState): void {
  if (nextQuotaState.summary) {
    statusBarItem.text = `$(zap) ${nextQuotaState.summary.usedPercentage.toFixed(0)}%  $(clock) ${formatDurationCompact(nextQuotaState.summary.nextResetTime)}`;
    statusBarItem.backgroundColor = getStatusBackgroundColor(nextQuotaState.summary.usedPercentage);
  } else if (nextQuotaState.status === "loading") {
    statusBarItem.text = "$(loading~spin) Usage ...";
    statusBarItem.backgroundColor = undefined;
  } else if (nextQuotaState.status === "missingApiKey") {
    statusBarItem.text = "$(key) Set API key";
    statusBarItem.backgroundColor = undefined;
  } else if (nextQuotaState.status === "authError") {
    statusBarItem.text = "$(warning) API auth failed";
    statusBarItem.backgroundColor = undefined;
  } else if (nextQuotaState.status === "rateLimited") {
    statusBarItem.text = "$(clock) Rate limited";
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = "$(warning) Quota unavailable";
    statusBarItem.backgroundColor = undefined;
  }

  statusBarItem.tooltip = buildTooltip(nextQuotaState);
  statusBarItem.command = getStatusBarCommand(nextQuotaState);
  statusBarItem.show();
}

async function setQuotaState(nextQuotaState: QuotaState): Promise<void> {
  quotaState = nextQuotaState;
  applyStatusBarState(nextQuotaState);
  await tokenSidebar.refresh(nextQuotaState);
}

function setQuotaStateLight(nextQuotaState: QuotaState): void {
  quotaState = nextQuotaState;
  applyStatusBarState(nextQuotaState);
  tokenSidebar.updateQuota(nextQuotaState);
}

function scheduleRefresh(delayMs: number): void {
  if (refreshTimer !== undefined) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    void refreshQuota(false);
  }, delayMs);
}

async function fetchQuota(): Promise<QuotaFetchResult> {
  const apiKey = await secrets.get("apiKey");
  if (!apiKey) {
    return { type: "missingApiKey" };
  }

  try {
    const response = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        type: "authError",
        message: "z.ai rejected the stored API key. Update it to refresh quota usage.",
      };
    }

    if (response.status === 429) {
      return {
        type: "rateLimited",
        retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after") ?? undefined),
      };
    }

    if (!response.ok) {
      return {
        type: "transientError",
        message: `Could not refresh quota usage (${response.status}).`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      logger.warn("Quota response JSON parse failed", error);
      return {
        type: "invalidResponse",
        message: "z.ai returned invalid quota JSON.",
      };
    }

    if (!isQuotaResponse(payload)) {
      return {
        type: "invalidResponse",
        message: "z.ai returned an unexpected quota payload.",
      };
    }

    const nextQuotaSummary = buildQuotaSummary(payload.data);
    if (!nextQuotaSummary) {
      return {
        type: "invalidResponse",
        message: "z.ai quota payload was missing token limits.",
      };
    }

    return {
      type: "success",
      data: payload.data,
      quotaSummary: nextQuotaSummary,
    };
  } catch (error) {
    logger.warn("Quota fetch failed", error);
    return {
      type: "transientError",
      message: "Could not reach the z.ai quota API.",
    };
  }
}

async function refreshQuota(showLoadingState: boolean): Promise<void> {
  if (refreshPromise) {
    if (showLoadingState) {
      setQuotaStateLight(LOADING_QUOTA_STATE);
    }
    return refreshPromise;
  }

  const refreshTask = (async () => {
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }

    if (showLoadingState) {
      await setQuotaState(LOADING_QUOTA_STATE);
    }

    const result = await fetchQuota();

    if (result.type === "success") {
      consecutiveTransientFailures = 0;
      await persistQuotaSummary(result.quotaSummary);
      await setQuotaState({
        status: "ready",
        message: "",
        summary: result.quotaSummary,
      });
      scheduleRefresh(getRefreshDelayMs());
      return;
    }

    if (result.type === "missingApiKey") {
      consecutiveTransientFailures = 0;
      await persistQuotaSummary(undefined);
      await setQuotaState({
        status: "missingApiKey",
        message: "Set your z.ai API key to load quota usage.",
      });
      scheduleRefresh(getRefreshDelayMs());
      return;
    }

    if (result.type === "authError") {
      consecutiveTransientFailures = 0;
      await persistQuotaSummary(undefined);
      await setQuotaState({
        status: "authError",
        message: result.message,
      });
      scheduleRefresh(getRefreshDelayMs());
      return;
    }

    if (result.type === "rateLimited") {
      consecutiveTransientFailures = 0;
      const retryDelayMs = Math.max(result.retryAfterMs ?? getRefreshDelayMs(), 1000);
      const retryMessage = `Rate limited by z.ai. Retrying in ${formatDelay(retryDelayMs)}.`;
      const lastQuotaSummary = getLastSuccessfulQuotaSummary();
      await setQuotaState(lastQuotaSummary
        ? {
          status: "rateLimited",
          message: `${retryMessage} Showing the last successful snapshot from ${formatAge(lastQuotaSummary.fetchedAt)}.`,
          summary: lastQuotaSummary,
        }
        : {
          status: "rateLimited",
          message: retryMessage,
        });
      scheduleRefresh(retryDelayMs);
      return;
    }

    consecutiveTransientFailures += 1;
    const retryDelayMs = getRetryDelayMs(consecutiveTransientFailures);
    const lastQuotaSummary = getLastSuccessfulQuotaSummary();
    await setQuotaState(lastQuotaSummary
      ? {
        status: "stale",
        message: `${result.message} Showing the last successful snapshot from ${formatAge(lastQuotaSummary.fetchedAt)}. Retrying in ${formatDelay(retryDelayMs)}.`,
        summary: lastQuotaSummary,
      }
      : {
        status: "unavailable",
        message: `${result.message} Retrying in ${formatDelay(retryDelayMs)}.`,
      });
    scheduleRefresh(retryDelayMs);
  })();

  refreshPromise = refreshTask;
  try {
    await refreshTask;
  } finally {
    if (refreshPromise === refreshTask) {
      refreshPromise = undefined;
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("TokenLens", { log: true });
  context.subscriptions.push(outputChannel);
  setLogSink((level, message, error) => {
    const formatted = formatLogMessage(message, error);
    if (level === "info") {
      outputChannel.info(formatted);
    } else if (level === "warn") {
      outputChannel.warn(formatted);
    } else {
      outputChannel.error(formatted);
    }
  });

  void preloadSqlModule().catch((error) => {
    logger.error("Failed to preload SQL module", error);
  });
  extensionContext = context;
  secrets = context.secrets;
  applyDatabasePathConfiguration();
  void migrateLegacyRefreshInterval();

  const storedQuotaSummary = context.globalState.get<QuotaSummary | undefined>(QUOTA_SNAPSHOT_STORAGE_KEY);
  persistedQuotaSummary = isQuotaSummary(storedQuotaSummary) ? storedQuotaSummary : undefined;

  tokenSidebar = new TokenSidebarProvider(context.extensionUri);
  tokenSidebar.setSettingsCallbacks({
    getApiKey: () => Promise.resolve(secrets.get("apiKey")),
    saveApiKey: async (apiKey: string) => {
      await secrets.store("apiKey", apiKey);
      vscode.window.showInformationMessage("API key saved securely.");
      await refreshQuota(true);
    },
    getRefreshIntervalMinutes,
    saveRefreshIntervalMinutes: async (minutes: number) => {
      await saveRefreshIntervalMinutes(minutes);
      scheduleRefresh(getRefreshDelayMs());
    },
    saveDatabasePath: saveDatabasePathSetting,
    getSavedModels,
    saveSavedModels,
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TokenSidebarProvider.viewType, tokenSidebar),
  );

  statusBarItem = vscode.window.createStatusBarItem(
    "token-lens",
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.name = "TokenLens";
  applyStatusBarState(LOADING_QUOTA_STATE);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("token-lens.refresh", async () => {
      tokenSidebar.invalidateCachedData();
      await refreshQuota(true);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${CONFIGURATION_SECTION}.databasePath`)) {
        applyDatabasePathConfiguration();
        tokenSidebar.invalidateCachedData();
        void tokenSidebar.refresh();
      }
      if (event.affectsConfiguration(`${CONFIGURATION_SECTION}.refreshIntervalMinutes`)) {
        scheduleRefresh(getRefreshDelayMs());
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("token-lens.setApiKey", async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your API key",
        password: true,
        ignoreFocusOut: true,
      });
      if (apiKey !== undefined) {
        await secrets.store("apiKey", apiKey);
        vscode.window.showInformationMessage("API key saved securely.");
        await refreshQuota(true);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("token-lens.openSettings", () => {
      tokenSidebar.showSettings();
    }),
  );

  void tokenSidebar.refresh(LOADING_QUOTA_STATE);
  void refreshQuota(true);

  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer !== undefined) {
        clearTimeout(refreshTimer);
      }
    },
  });
}

export function deactivate(): void {
  closeDatabase();
}

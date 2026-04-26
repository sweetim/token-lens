import * as vscode from "vscode";
import { TokenSidebarProvider } from "./tokenSidebar";
import type { QuotaState, QuotaSummary } from "./types.js";

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
const NORMAL_REFRESH_DELAY_MS = 5 * 60 * 1000;
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
    return "now";
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
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

function buildQuotaSummary(data: QuotaResponse["data"]): QuotaSummary | undefined {
  const tokenLimit = data.limits.find((limit) => limit.type === "TOKENS_LIMIT");
  if (!tokenLimit) {
    return undefined;
  }

  const usedPercentage = tokenLimit.percentage ?? 0;
  const limitTokens = tokenLimit.number ?? 0;
  const usedTokens = tokenLimit.usage
    ?? tokenLimit.currentValue
    ?? (limitTokens > 0 ? Math.round((limitTokens * usedPercentage) / 100) : 0);
  const remainingTokens = tokenLimit.remaining ?? Math.max(limitTokens - usedTokens, 0);
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
    const color = index < barFilled ? gradientColors[Math.min(index, gradientColors.length - 1)] : "#555";
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
  return typeof maybeSummary.usedTokens === "number"
    && typeof maybeSummary.limitTokens === "number"
    && typeof maybeSummary.remainingTokens === "number"
    && typeof maybeSummary.usedPercentage === "number"
    && typeof maybeSummary.remainingPercentage === "number"
    && typeof maybeSummary.nextResetTime === "number"
    && typeof maybeSummary.fetchedAt === "number";
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

function getLastSuccessfulQuotaSummary(): QuotaSummary | undefined {
  return quotaState.summary ?? persistedQuotaSummary;
}

async function persistQuotaSummary(nextQuotaSummary: QuotaSummary | undefined): Promise<void> {
  persistedQuotaSummary = nextQuotaSummary;
  await extensionContext.globalState.update(QUOTA_SNAPSHOT_STORAGE_KEY, nextQuotaSummary);
}

function applyStatusBarState(nextQuotaState: QuotaState): void {
  if (nextQuotaState.summary) {
    statusBarItem.text = `$(zap) ${nextQuotaState.summary.usedPercentage.toFixed(0)}%`;
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
    } catch {
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
  } catch {
    return {
      type: "transientError",
      message: "Could not reach the z.ai quota API.",
    };
  }
}

async function refreshQuota(showLoadingState: boolean): Promise<void> {
  if (refreshPromise) {
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
      scheduleRefresh(NORMAL_REFRESH_DELAY_MS);
      return;
    }

    if (result.type === "missingApiKey") {
      consecutiveTransientFailures = 0;
      await persistQuotaSummary(undefined);
      await setQuotaState({
        status: "missingApiKey",
        message: "Set your z.ai API key to load quota usage.",
      });
      scheduleRefresh(NORMAL_REFRESH_DELAY_MS);
      return;
    }

    if (result.type === "authError") {
      consecutiveTransientFailures = 0;
      await persistQuotaSummary(undefined);
      await setQuotaState({
        status: "authError",
        message: result.message,
      });
      scheduleRefresh(NORMAL_REFRESH_DELAY_MS);
      return;
    }

    if (result.type === "rateLimited") {
      consecutiveTransientFailures = 0;
      const retryDelayMs = Math.max(result.retryAfterMs ?? NORMAL_REFRESH_DELAY_MS, 1000);
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
  extensionContext = context;
  secrets = context.secrets;

  const storedQuotaSummary = context.globalState.get<QuotaSummary | undefined>(QUOTA_SNAPSHOT_STORAGE_KEY);
  persistedQuotaSummary = isQuotaSummary(storedQuotaSummary) ? storedQuotaSummary : undefined;

  tokenSidebar = new TokenSidebarProvider(context.extensionUri);
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
      await refreshQuota(true);
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

export function deactivate(): void {}

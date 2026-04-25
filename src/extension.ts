import * as vscode from "vscode";
import { TokenSidebarProvider } from "./tokenSidebar";
import type { QuotaSummary } from "./types.js";

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

function buildBar(usedPct: number): string {
  const filled = Math.round((usedPct / 100) * 10);
  return "░".repeat(filled) + "█".repeat(10 - filled);
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
    resetTimeLabel: formatResetTime(tokenLimit.nextResetTime),
    resetDurationLabel: formatDuration(tokenLimit.nextResetTime),
  };
}

function buildTooltip(data: QuotaResponse["data"]): vscode.MarkdownString {
  const md = new vscode.MarkdownString("", true);
  md.supportHtml = true;
  md.isTrusted = true;

  const tokenLimit = data.limits.find((l) => l.type === "TOKENS_LIMIT");
  const usedPct = tokenLimit?.percentage ?? 0;

  const gradientColors = [
    "#4ec9b0", "#5ec47a", "#7ebc4a", "#a0b030",
    "#c8a020", "#e08c18", "#e87020", "#f05828",
    "#f44040", "#f44767",
  ];
  const barFilled = Math.round((usedPct / 100) * 20);
  let bar = "";
  for (let i = 0; i < 20; i++) {
    const color = i < barFilled ? gradientColors[Math.min(i, gradientColors.length - 1)] : "#555";
    bar += `<span style="color:${color};">█</span>`;
  }

  md.appendMarkdown(`<span style="font-size:13px;"><b>$(spark) Token Lens - zai</b></span>\n\n`);
  md.appendMarkdown(`<code style="font-size:10px;letter-spacing:-1px;">${bar}</code> | **${usedPct.toFixed(0)}%**\n\n`);
  if (tokenLimit) {
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`$(clock) Resets **${formatDuration(tokenLimit.nextResetTime)}**\n\n`);
    md.appendMarkdown(`<span style="color:var(--vscode-descriptionForeground);">${formatResetTime(tokenLimit.nextResetTime)}</span>`);
  }

  return md;
}

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let secrets: vscode.SecretStorage;
let tokenSidebar: TokenSidebarProvider;

async function fetchUsage(): Promise<QuotaResponse | undefined> {
  const apiKey = await secrets.get("apiKey");
  if (!apiKey) {
    return undefined;
  }
  try {
    const response = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return undefined;
    }
    return (await response.json()) as QuotaResponse;
  } catch {
    return undefined;
  }
}

async function updateStatusBar(): Promise<QuotaSummary | null> {
  const data = await fetchUsage();
  if (!data?.data) {
    statusBarItem.text = "$(zap) TokenLens ?";
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = "No API key configured. Click to set API key.";
    statusBarItem.command = {
      command: "token-lens.setApiKey",
      title: "Set API Key",
    };
    statusBarItem.show();
    return null;
  }

  const tokenLimit = data.data.limits.find((l) => l.type === "TOKENS_LIMIT");
  const usedPct = tokenLimit?.percentage ?? 0;
  const quotaSummary = buildQuotaSummary(data.data);

  statusBarItem.text = `$(zap) ${usedPct.toFixed(0)}%`;
  statusBarItem.backgroundColor = getStatusBackgroundColor(usedPct);
  statusBarItem.tooltip = buildTooltip(data.data);
  statusBarItem.command = {
    command: "token-lens.refresh",
    title: "Refresh",
  };
  statusBarItem.show();

  return quotaSummary ?? null;
}

export function activate(context: vscode.ExtensionContext): void {
  secrets = context.secrets;

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
  statusBarItem.text = "$(zap) TokenLens ...";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("token-lens.refresh", async () => {
      statusBarItem.text = "$(loading~spin) Usage ...";
      const quotaSummary = await updateStatusBar();
      await tokenSidebar.refresh(quotaSummary);
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
        const quotaSummary = await updateStatusBar();
        await tokenSidebar.refresh(quotaSummary);
      }
    }),
  );

  void (async () => {
    const quotaSummary = await updateStatusBar();
    await tokenSidebar.refresh(quotaSummary);
  })();

  refreshTimer = setInterval(() => {
    void (async () => {
      const quotaSummary = await updateStatusBar();
      await tokenSidebar.refresh(quotaSummary);
    })();
  }, 5 * 60 * 1000);
  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
      }
    },
  });
}

export function deactivate(): void {}

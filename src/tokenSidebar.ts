import * as vscode from "vscode";
import { getCurrentDatabaseMtimeMs, getDatabasePath, getLoadedDatabaseMtimeMs, querySidebarData } from "@/db";
import { getHtmlFromData } from "@/html";
import { logger } from "@/logger";
import { fetchModelDataWithStatus, isModelDataCacheFresh } from "@/model-data";
import type { ModelData } from "@/model-data";
import { buildQuotaStateData, buildWebviewData } from "@/webview/data";
import type { QuotaState } from "@/types";
import type { SettingsData, WebviewData, WebviewOutboundMessage } from "@/webview-contract";

const EMPTY_MODEL_DATA: ModelData = { createdDates: {}, pricing: {} };

const DEFAULT_QUOTA_STATE: QuotaState = {
  status: "loading",
  message: "Loading quota from z.ai.",
};

const LOADING_WEBVIEW_DATA: WebviewData = {
  dayData: [],
  dailyCharts: [],
  projectCharts: [],
  dailyChartIds: [],
  dailyChartData: [],
  projectChartDataSets: {},
  defaultTab: "daily",
  modelPricing: {},
  pricingState: { status: "loading", message: "Loading OpenRouter model prices..." },
  projectTokenBreakdowns: {},
  projectModelIds: {},
  quotaState: { status: "loading", message: "Loading\u2026", summary: null },
  hero: { todayTokens: 0, totalTokens: 0, totalCost: 0, totalSessions: 0 },
  projects: [],
  grandTokens: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheRead: 0 },
  costEntries: [],
  providers: [],
  threeMonthsAgo: 0,
  hasData: false,
  hasDays: false,
  hasProjects: false,
  savedModels: [],
};

function buildFailureWebviewData(quotaState: QuotaState, savedModels: string[]): WebviewData {
  return {
    ...LOADING_WEBVIEW_DATA,
    quotaState: {
      status: quotaState.status,
      message: quotaState.message,
      summary: quotaState.summary
        ? {
            usedPercentage: quotaState.summary.usedPercentage,
            remainingPercentage: quotaState.summary.remainingPercentage,
            nextResetTime: quotaState.summary.nextResetTime,
          }
        : null,
    },
    savedModels,
  };
}

type SettingsCallbacks = {
  getApiKey: () => Promise<string | undefined>;
  saveApiKey: (apiKey: string) => Promise<void>;
  getRefreshIntervalMinutes: () => number;
  saveRefreshIntervalMinutes: (minutes: number) => Promise<void>;
  saveDatabasePath: (databasePath: string) => Promise<void>;
  getSavedModels: () => string[];
  saveSavedModels: (savedModels: string[]) => Promise<void>;
};

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;
  private quotaState: QuotaState = DEFAULT_QUOTA_STATE;
  private initialized = false;
  private webviewReady = false;
  private latestWebviewData?: WebviewData;
  private refreshGeneration = 0;
  private lastQueriedMtimeMs = -1;
  private settingsCallbacks?: SettingsCallbacks;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public setSettingsCallbacks(callbacks: SettingsCallbacks): void {
    this.settingsCallbacks = callbacks;
  }

  public showSettings(): void {
    if (this.view) {
      void this.view.webview.postMessage({ type: "showSettings" });
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.initialized = false;
    this.webviewReady = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };
    webviewView.webview.onDidReceiveMessage(async (message: WebviewOutboundMessage | undefined) => {
      if (!message || webviewView !== this.view) {
        return;
      }

      if (message.type === "ready") {
        this.webviewReady = true;
        if (this.latestWebviewData) {
          void webviewView.webview.postMessage({ type: "fullUpdate", data: this.latestWebviewData });
        }
        return;
      }

      if (message.type === "requestSettings") {
        void this.handleRequestSettings();
        return;
      }

      if (message.type === "saveApiKey") {
        await this.settingsCallbacks?.saveApiKey(message.apiKey);
        void this.handleRequestSettings();
        return;
      }

      if (message.type === "saveRefreshInterval") {
        await this.settingsCallbacks?.saveRefreshIntervalMinutes(message.minutes);
        void this.handleRequestSettings();
        return;
      }

      if (message.type === "saveDatabasePath") {
        await this.settingsCallbacks?.saveDatabasePath(message.databasePath);
        void this.handleRequestSettings();
        return;
      }

      if (message.type === "saveSavedModels") {
        void this.settingsCallbacks?.saveSavedModels(message.savedModels);
        return;
      }
    });

    webviewView.webview.html = getHtmlFromData({
      extensionUri: this.extensionUri,
      webview: webviewView.webview,
      webviewData: LOADING_WEBVIEW_DATA,
    });
    this.initialized = true;

    this.refresh();
  }

  private async handleRequestSettings(): Promise<void> {
    if (!this.view || !this.settingsCallbacks) {
      return;
    }
    const settings: SettingsData = {
      hasApiKey: !!(await this.settingsCallbacks.getApiKey()),
      refreshIntervalMinutes: this.settingsCallbacks.getRefreshIntervalMinutes(),
      databasePath: getDatabasePath(),
    };
    void this.view.webview.postMessage({ type: "settingsData", data: settings });
  }

  public updateQuota(quotaState: QuotaState): void {
    this.quotaState = quotaState;
    const quotaStateData = buildQuotaStateData(quotaState);
    if (this.latestWebviewData) {
      this.latestWebviewData = {
        ...this.latestWebviewData,
        quotaState: quotaStateData,
      };
    }
    if (this.view && this.webviewReady) {
      void this.view.webview.postMessage({ type: "quotaUpdate", quotaState: quotaStateData });
    }
  }

  public invalidateCachedData(): void {
    this.lastQueriedMtimeMs = -1;
  }

  private async canSkipDataRebuild(): Promise<boolean> {
    if (!this.latestWebviewData?.hasData || !isModelDataCacheFresh()) {
      return false;
    }
    try {
      return (await getCurrentDatabaseMtimeMs()) === this.lastQueriedMtimeMs;
    } catch {
      return false;
    }
  }

  private sendToWebview(currentView: vscode.WebviewView): void {
    if (!this.latestWebviewData) {
      return;
    }
    if (!this.initialized) {
      currentView.webview.html = getHtmlFromData({
        extensionUri: this.extensionUri,
        webview: currentView.webview,
        webviewData: this.latestWebviewData,
      });
      this.initialized = true;
    } else if (this.webviewReady) {
      void currentView.webview.postMessage({ type: "fullUpdate", data: this.latestWebviewData });
    }
  }

  public async refresh(quotaState: QuotaState = this.quotaState): Promise<void> {
    this.quotaState = quotaState;
    const currentView = this.view;
    if (!currentView) {
      return;
    }

    if (await this.canSkipDataRebuild()) {
      if (currentView !== this.view) {
        return;
      }
      this.updateQuota(quotaState);
      return;
    }

    const refreshGeneration = ++this.refreshGeneration;

    try {
      const modelDataCacheWasFresh = isModelDataCacheFresh();
      const { projects, days, projectDays, modelCosts, projectModels, dayModels } = await querySidebarData();
      this.lastQueriedMtimeMs = getLoadedDatabaseMtimeMs();

      const projectModelsMap = new Map<string, typeof projectModels>();
      for (const row of projectModels) {
        const rows = projectModelsMap.get(row.project);
        if (rows) {
          rows.push(row);
        } else {
          projectModelsMap.set(row.project, [row]);
        }
      }

      const dayModelsMap = new Map<string, typeof dayModels>();
      for (const row of dayModels) {
        const rows = dayModelsMap.get(row.day);
        if (rows) {
          rows.push(row);
        } else {
          dayModelsMap.set(row.day, [row]);
        }
      }

      for (const project of projects) {
        const rows = projectModelsMap.get(project.project) ?? [];
        project.models = rows.map((r) => ({
          model: r.model,
          provider: r.provider,
          steps: r.steps,
          totalTokens: r.totalTokens,
          totalCost: r.totalCost,
        }));
      }

      for (const day of days) {
        const rows = dayModelsMap.get(day.day) ?? [];
        day.models = rows.map((r) => ({
          model: r.model,
          provider: r.provider,
          steps: r.steps,
          totalTokens: r.totalTokens,
          totalCost: r.totalCost,
        }));
      }

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      if (!modelDataCacheWasFresh) {
        const partialData = await buildWebviewData(projects, days, projectDays, modelCosts, this.quotaState, EMPTY_MODEL_DATA, "loading", this.settingsCallbacks?.getSavedModels() ?? []);

        if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
          return;
        }

        this.latestWebviewData = partialData;
        this.sendToWebview(currentView);
      }

      const modelData = await fetchModelDataWithStatus();

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      const fullData = await buildWebviewData(projects, days, projectDays, modelCosts, this.quotaState, modelData.data, modelData.status, this.settingsCallbacks?.getSavedModels() ?? []);

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      this.latestWebviewData = fullData;
      this.sendToWebview(currentView);
    } catch (error) {
      logger.error("Failed to query sidebar data", error);

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      if (!this.latestWebviewData || !this.latestWebviewData.hasData) {
        this.latestWebviewData = buildFailureWebviewData(this.quotaState, this.settingsCallbacks?.getSavedModels() ?? []);
        this.sendToWebview(currentView);
      }
    }
  }
}

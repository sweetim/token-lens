import * as vscode from "vscode";
import { DB_PATH, queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels } from "./db.js";
import { getHtml, getHtmlFromData } from "./html.js";
import { fetchModelData } from "./model-data.js";
import type { ModelData } from "./model-data.js";
import { buildWebviewData } from "./webview/data.js";
import type { QuotaState } from "./types.js";
import type { SettingsData, WebviewData, WebviewOutboundMessage } from "./webview-contract.js";

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
  projectTokenBreakdowns: {},
  projectModelIds: {},
  quotaState: { status: "loading", message: "Loading\u2026", summary: null },
  hero: { todayTokens: 0, totalTokens: 0, totalCost: 0, totalSteps: 0 },
  projects: [],
  grandTokens: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheRead: 0 },
  costEntries: [],
  providers: [],
  threeMonthsAgo: 0,
  hasData: false,
  hasDays: false,
  hasProjects: false,
};

type SettingsCallbacks = {
  getApiKey: () => Promise<string | undefined>;
  saveApiKey: (apiKey: string) => Promise<void>;
  getRefreshIntervalMinutes: () => number;
  saveRefreshIntervalMinutes: (minutes: number) => Promise<void>;
};

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;
  private quotaState: QuotaState = DEFAULT_QUOTA_STATE;
  private initialized = false;
  private webviewReady = false;
  private latestWebviewData?: WebviewData;
  private refreshGeneration = 0;
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
    webviewView.webview.onDidReceiveMessage((message: WebviewOutboundMessage | undefined) => {
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
        void this.settingsCallbacks?.saveApiKey(message.apiKey);
        void this.handleRequestSettings();
        return;
      }

      if (message.type === "saveRefreshInterval") {
        void this.settingsCallbacks?.saveRefreshIntervalMinutes(message.minutes);
        void this.handleRequestSettings();
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
      databasePath: DB_PATH,
    };
    void this.view.webview.postMessage({ type: "settingsData", data: settings });
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

    const refreshGeneration = ++this.refreshGeneration;

    try {
      const [projects, days, projectDays, modelCosts, projectModels, dayModels] = await Promise.all([
        queryProjectTokens(),
        queryDayTokens(),
        queryProjectDayTokens(),
        queryModelCosts(),
        queryProjectModels(),
        queryDayModels(),
      ]);

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

      const partialData = await buildWebviewData(projects, days, projectDays, modelCosts, quotaState, EMPTY_MODEL_DATA);

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      this.latestWebviewData = partialData;
      this.sendToWebview(currentView);

      const modelData = await fetchModelData();

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      const fullData = await buildWebviewData(projects, days, projectDays, modelCosts, quotaState, modelData);

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      this.latestWebviewData = fullData;
      this.sendToWebview(currentView);
    } catch {
      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      if (!this.initialized) {
        const fallbackHtml = await getHtml(currentView.webview, this.extensionUri, [], [], [], [], quotaState);

        if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
          return;
        }

        currentView.webview.html = fallbackHtml;
        this.initialized = true;
      }
    }
  }
}

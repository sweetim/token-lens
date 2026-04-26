import * as vscode from "vscode";
import { queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels } from "./db.js";
import { getHtml, getHtmlFromData } from "./html.js";
import { buildWebviewData } from "./webview/data.js";
import type { QuotaState } from "./types.js";
import type { WebviewData, WebviewOutboundMessage } from "./webview-contract.js";

const DEFAULT_QUOTA_STATE: QuotaState = {
  status: "loading",
  message: "Loading quota from z.ai.",
};

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;
  private quotaState: QuotaState = DEFAULT_QUOTA_STATE;
  private initialized = false;
  private webviewReady = false;
  private latestWebviewData?: WebviewData;
  private refreshGeneration = 0;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.initialized = false;
    this.webviewReady = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };
    webviewView.webview.onDidReceiveMessage((message: WebviewOutboundMessage | undefined) => {
      if (message?.type !== "ready") {
        return;
      }

      if (webviewView !== this.view) {
        return;
      }

      this.webviewReady = true;
      if (this.latestWebviewData) {
        void webviewView.webview.postMessage({ type: "fullUpdate", data: this.latestWebviewData });
      }
    });
    this.refresh();
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

      const nextWebviewData = await buildWebviewData(projects, days, projectDays, modelCosts, quotaState);

      if (refreshGeneration !== this.refreshGeneration || currentView !== this.view) {
        return;
      }

      this.latestWebviewData = nextWebviewData;

      if (!this.initialized) {
        currentView.webview.html = getHtmlFromData({
          extensionUri: this.extensionUri,
          webview: currentView.webview,
          webviewData: nextWebviewData,
        });
        this.initialized = true;
      } else if (this.webviewReady) {
        void currentView.webview.postMessage({ type: "fullUpdate", data: nextWebviewData });
      }
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

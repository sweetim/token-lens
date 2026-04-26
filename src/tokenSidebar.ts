import * as vscode from "vscode";
import { queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels } from "./db.js";
import { getHtml } from "./html.js";
import { buildWebviewData } from "./webview/data.js";
import type { QuotaState } from "./types.js";

const DEFAULT_QUOTA_STATE: QuotaState = {
  status: "loading",
  message: "Loading quota from z.ai.",
};

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;
  private quotaState: QuotaState = DEFAULT_QUOTA_STATE;
  private initialized = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };
    this.refresh();
  }

  public async refresh(quotaState: QuotaState = this.quotaState): Promise<void> {
    this.quotaState = quotaState;
    if (!this.view) {
      return;
    }
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

      if (!this.initialized) {
        this.view.webview.html = await getHtml(this.view.webview, this.extensionUri, projects, days, projectDays, modelCosts, this.quotaState);
        this.initialized = true;
      } else {
        const webviewData = await buildWebviewData(projects, days, projectDays, modelCosts, this.quotaState);
        this.view.webview.postMessage({ type: "fullUpdate", data: webviewData });
      }
    } catch {
      if (!this.initialized) {
        this.view.webview.html = await getHtml(this.view.webview, this.extensionUri, [], [], [], [], this.quotaState);
        this.initialized = true;
      }
    }
  }
}

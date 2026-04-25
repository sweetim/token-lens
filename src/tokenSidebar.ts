import * as vscode from "vscode";
import { queryProjectTokens, queryDayTokens, queryProjectDayTokens, queryModelCosts, queryProjectModels, queryDayModels } from "./db.js";
import { getHtml } from "./html.js";
import type { QuotaSummary } from "./types.js";

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;
  private quotaSummary?: QuotaSummary;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.refresh();
  }

  public async refresh(quotaSummary: QuotaSummary | null = this.quotaSummary ?? null): Promise<void> {
    this.quotaSummary = quotaSummary ?? undefined;
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

      this.view.webview.html = getHtml(this.view.webview, this.extensionUri, projects, days, projectDays, modelCosts, this.quotaSummary);
    } catch {
      this.view.webview.html = getHtml(this.view.webview, this.extensionUri, [], [], [], [], this.quotaSummary);
    }
  }
}

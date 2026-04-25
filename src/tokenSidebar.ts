import * as vscode from "vscode";
import { queryProjectTokens, queryDayTokens, queryProjectDayTokens } from "./db.js";
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
      const [projects, days, projectDays] = await Promise.all([queryProjectTokens(), queryDayTokens(), queryProjectDayTokens()]);
      this.view.webview.html = getHtml(projects, days, projectDays, this.quotaSummary);
    } catch {
      this.view.webview.html = getHtml([], [], [], this.quotaSummary);
    }
  }
}

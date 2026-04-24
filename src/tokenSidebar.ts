import * as vscode from "vscode";
import { queryProjectTokens, queryDayTokens } from "./db.js";
import { getHtml } from "./html.js";

export class TokenSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "token-lens.tokenSidebar";
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    try {
      const [projects, days] = await Promise.all([queryProjectTokens(), queryDayTokens()]);
      this.view.webview.html = getHtml(projects, days);
    } catch {
      this.view.webview.html = getHtml([], []);
    }
  }
}

import type { DayTokens, ModelCost, ProjectDayTokens, ProjectTokens, QuotaState } from "./types.js";
import * as vscode from "vscode";
import { buildWebviewData } from "./webview/data.js";
import { buildWebviewDocument } from "./webview/document.js";
import type { WebviewData } from "./webview-contract.js";

type WebviewHtmlParams = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  webviewData: WebviewData;
};

function getHtmlFromData({ extensionUri, webview, webviewData }: WebviewHtmlParams): string {
  return buildWebviewDocument({ extensionUri, webview, webviewData });
}

async function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  projects: ProjectTokens[],
  days: DayTokens[],
  projectDays: ProjectDayTokens[],
  modelCosts: ModelCost[],
  quotaState: QuotaState,
): Promise<string> {
  const webviewData = await buildWebviewData(projects, days, projectDays, modelCosts, quotaState);
  return getHtmlFromData({ extensionUri, webview, webviewData });
}

export { getHtml, getHtmlFromData };

import type { DayTokens, ModelCost, ProjectDayTokens, ProjectTokens, QuotaState } from "./types.js";
import * as vscode from "vscode";
import { buildWebviewData } from "./webview/data.js";
import { buildWebviewDocument } from "./webview/document.js";

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
  return buildWebviewDocument({ extensionUri, webview, webviewData });
}

export { getHtml };

import * as vscode from "vscode";
import { buildWebviewDocument } from "@/webview/document";
import type { WebviewData } from "@/webview-contract";

type WebviewHtmlParams = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  webviewData: WebviewData;
};

function getHtmlFromData({ extensionUri, webview, webviewData }: WebviewHtmlParams): string {
  return buildWebviewDocument({ extensionUri, webview, webviewData });
}

export { getHtmlFromData };

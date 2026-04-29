import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { WEBVIEW_DATA_ELEMENT_ID } from "@/webview-contract";
import type { WebviewData } from "@/webview-contract";

const STYLES = fs.readFileSync(path.join(__dirname, "webview-client.css"), "utf8");

type WebviewDocumentParams = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  webviewData: WebviewData;
};

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

function serializeWebviewData(webviewData: WebviewData): string {
  return JSON.stringify(webviewData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildContentSecurityPolicy(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
    "connect-src https:",
  ].join("; ");
}

function buildWebviewDocument({ extensionUri, webview, webviewData }: WebviewDocumentParams): string {
  const nonce = createNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview-client.js"));
  const contentSecurityPolicy = buildContentSecurityPolicy(webview, nonce);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
<style>${STYLES}
</style>
</head>
<body>
  <div id="root"></div>
  <script id="${WEBVIEW_DATA_ELEMENT_ID}" type="application/json">${serializeWebviewData(webviewData)}</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export { buildWebviewDocument };

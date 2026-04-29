import { render, type ComponentChildren } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { App } from "@/App";
import { postWebviewMessage, readWebviewData } from "@/bootstrap";
import "@/tailwind.css";
import type { WebviewData, WebviewInboundMessage, SettingsData } from "@shared/webview-contract";

const DEFAULT_SETTINGS: SettingsData = {
  hasApiKey: false,
  refreshIntervalMinutes: 5,
  databasePath: "",
};

const THEME_VARIABLES = "--fg: var(--vscode-foreground); --bg: var(--vscode-sideBar-background); --muted: var(--vscode-descriptionForeground); --accent: var(--vscode-charts-blue, #3794ff); --accent2: var(--vscode-charts-purple, #b180d7); --green: var(--vscode-charts-green, #89d185); --orange: var(--vscode-charts-orange, #d18616); --card-bg: var(--vscode-editor-background); --border: var(--vscode-widget-border, rgba(128,128,128,.25)); font-family: var(--vscode-font-family, -apple-system, sans-serif); font-size: var(--vscode-font-size, 13px);";

function WebviewFrame({ children }: { children: ComponentChildren }) {
  return (
    <div class="fixed inset-0 flex flex-col overflow-hidden bg-(--bg) text-(--fg)" style={THEME_VARIABLES}>
      {children}
    </div>
  );
}

function Root() {
  const [data, setData] = useState<WebviewData>(readWebviewData);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data as WebviewInboundMessage | undefined;
      if (!message) return;
      if (message.type === "fullUpdate" && message.data) {
        setData(message.data);
      } else if (message.type === "showSettings") {
        setShowSettings(true);
        postWebviewMessage({ type: "requestSettings" });
      } else if (message.type === "settingsData" && message.data) {
        setSettings(message.data);
      }
    }

    window.addEventListener("message", handleMessage);
    postWebviewMessage({ type: "ready" });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  if (showSettings) {
    return <WebviewFrame><App data={data} settings={settings} showSettings={showSettings} onCloseSettings={handleCloseSettings} /></WebviewFrame>;
  }

  return <WebviewFrame><App data={data} /></WebviewFrame>;
}

render(<Root />, document.getElementById("root")!);

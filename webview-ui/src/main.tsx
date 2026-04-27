import { render } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { App } from "./App.js";
import { postWebviewMessage, readWebviewData } from "./bootstrap.js";
import type { WebviewData, WebviewInboundMessage, SettingsData } from "../../src/webview-contract.js";

const DEFAULT_SETTINGS: SettingsData = {
  hasApiKey: false,
  refreshIntervalMinutes: 5,
  databasePath: "",
};

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
    return <App data={data} settings={settings} showSettings={showSettings} onCloseSettings={handleCloseSettings} />;
  }

  return <App data={data} />;
}

render(<Root />, document.getElementById("root")!);

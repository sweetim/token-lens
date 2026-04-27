import { useState } from "preact/hooks";
import type { SettingsData } from "../../../src/webview-contract.js";
import { postWebviewMessage } from "../bootstrap.js";

type SettingsPanelProps = {
  settings: SettingsData;
  onClose: () => void;
};

function SettingsPanel({ settings, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(String(settings.refreshIntervalMinutes));
  const [intervalSaved, setIntervalSaved] = useState(false);

  function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    postWebviewMessage({ type: "saveApiKey", apiKey: apiKey.trim() });
    setApiKey("");
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  function handleSaveInterval() {
    const minutes = Number(refreshInterval);
    if (!Number.isFinite(minutes) || minutes < 1) return;
    postWebviewMessage({ type: "saveRefreshInterval", minutes });
    setIntervalSaved(true);
    setTimeout(() => setIntervalSaved(false), 2000);
  }

  return (
    <div class="settings-panel">
      <div class="settings-header">
        <span class="settings-title">Settings</span>
        <button class="settings-close" onClick={onClose} title="Close settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 8.707l-3.646 3.647-.708-.707L7.293 8 3.646 4.354l.708-.707L8 7.293l3.646-3.646.708.707L8.707 8l3.647 3.646-.708.707L8 8.707z" />
          </svg>
        </button>
      </div>

      <div class="settings-section">
        <label class="settings-label">z.ai API Key</label>
        <div class="settings-input-row">
          <input
            class="settings-input"
            type={apiKeyVisible ? "text" : "password"}
            placeholder={settings.hasApiKey ? "Enter new key to replace" : "Enter your API key"}
            value={apiKey}
            onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
          />
          <button
            class="settings-btn-icon"
            onClick={() => setApiKeyVisible(!apiKeyVisible)}
            title={apiKeyVisible ? "Hide" : "Show"}
          >
            {apiKeyVisible ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5c-1.2-2.9-4-5-7.5-5zm0 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 11.5c-1.93 0-3.5-1.57-3.5-3.5 0-.17.01-.33.04-.49l-.84-.84A4.47 4.47 0 003 8c1.12 2.7 3.8 4.5 7 4.5.65 0 1.27-.08 1.87-.22l-.65-.65A5.37 5.37 0 018 11.5zm4.96-.64l-.7-.7A4.49 4.49 0 0013 8c-1.12-2.7-3.8-4.5-7-4.5-.65 0-1.27.08-1.87.22L2.15 1.74l-.7.7 12.2 12.2.7-.7-1.39-2.08zM9.88 6.47L8.53 5.12A2.24 2.24 0 019.88 6.47z"/></svg>
            )}
          </button>
          <button class="settings-btn" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
            {apiKeySaved ? "Saved" : "Save"}
          </button>
        </div>
        {settings.hasApiKey && <span class="settings-hint">An API key is already configured.</span>}
      </div>

      <div class="settings-section">
        <label class="settings-label">Kilo Database Path</label>
        <div class="settings-input-row">
          <input
            class="settings-input settings-input-readonly"
            type="text"
            value={settings.databasePath}
            readOnly
          />
          <button class="settings-btn-icon" onClick={() => navigator.clipboard.writeText(settings.databasePath)} title="Copy path">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h6v1H4V4zm0 3h6v1H4V7zm0 3h4v1H4v-1zm8.5-8H5.5A1.5 1.5 0 004 3.5v7A1.5 1.5 0 005.5 12h7a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0012.5 2zm.5 8.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5h7a.5.5 0 01.5.5v7zM2 5.5A1.5 1.5 0 013.5 4H3v8.5a.5.5 0 00.5.5H12v.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-8z"/></svg>
          </button>
        </div>
        <span class="settings-hint">Token usage data is read from this SQLite database.</span>
      </div>

      <div class="settings-section">
        <label class="settings-label">Refresh Interval (minutes)</label>
        <div class="settings-input-row">
          <input
            class="settings-input"
            type="number"
            min="1"
            value={refreshInterval}
            onInput={(e) => setRefreshInterval((e.target as HTMLInputElement).value)}
          />
          <button class="settings-btn" onClick={handleSaveInterval} disabled={Number(refreshInterval) < 1}>
            {intervalSaved ? "Saved" : "Save"}
          </button>
        </div>
        <span class="settings-hint">How often to automatically refresh quota data.</span>
      </div>
    </div>
  );
}

export { SettingsPanel };

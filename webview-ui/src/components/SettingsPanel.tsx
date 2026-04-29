import { useState } from "preact/hooks";
import type { SettingsData } from "@shared/webview-contract";
import { postWebviewMessage } from "@/bootstrap";

type SettingsPanelProps = {
  settings: SettingsData;
  onClose: () => void;
};

const ICON_BUTTON_CLASS = "box-border inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-1 text-(--muted) transition-colors hover:bg-(--border) hover:text-(--fg) disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-(--muted)";
const INPUT_CLASS = "box-border min-w-0 w-full flex-1 rounded border border-(--border) bg-[var(--vscode-input-background,rgba(0,0,0,.3))] px-2 py-1.5 font-[var(--vscode-editor-font-family,monospace)] text-xs text-(--fg) outline-none focus:border-(--accent)";
const ACTION_ROW_CLASS = "grid w-full items-center gap-1.5 [grid-template-columns:minmax(0,1fr)_1.75rem]";
const SECTION_CLASS = "flex flex-col gap-1.5";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[.5px] text-(--muted)";
const HINT_CLASS = "text-[10px] leading-[1.4] text-(--muted)";

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 2.5h7.25l1.75 1.75v9.25h-9v-11z" />
      <path d="M5.25 2.5v4h5.5v-4" />
      <path d="M5.5 10.5h5" />
      <path d="M5.5 13.5v-4h5v4" />
    </svg>
  );
}

function SettingsPanel({ settings, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(String(settings.refreshIntervalMinutes));
  const [intervalSaved, setIntervalSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    postWebviewMessage({ type: "saveApiKey", apiKey: apiKey.trim() });
    setApiKey("");
    setApiKeySaved(true);
    showToast("API Key saved successfully");
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  function handleSaveInterval() {
    const minutes = Number(refreshInterval);
    if (!Number.isFinite(minutes) || minutes < 1) return;
    postWebviewMessage({ type: "saveRefreshInterval", minutes });
    setIntervalSaved(true);
    showToast("Refresh interval saved successfully");
    setTimeout(() => setIntervalSaved(false), 2000);
  }

  return (
    <div class="flex flex-col gap-5 px-3.5 py-4">
      {toast && (
        <div class="fixed top-2 right-2 left-2 z-50 rounded border border-(--accent) bg-(--bg) px-3 py-2 text-xs text-(--accent) shadow-lg">
          {toast}
        </div>
      )}
      <div class="flex items-center justify-between">
        <span class="text-[13px] font-bold uppercase tracking-[.5px]">Settings</span>
        <button class={ICON_BUTTON_CLASS} onClick={onClose} title="Close settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 8.707l-3.646 3.647-.708-.707L7.293 8 3.646 4.354l.708-.707L8 7.293l3.646-3.646.708.707L8.707 8l3.647 3.646-.708.707L8 8.707z" />
          </svg>
        </button>
      </div>

      <div class={SECTION_CLASS}>
        <label class={LABEL_CLASS}>z.ai API Key</label>
        <div class={ACTION_ROW_CLASS}>
          <div class="relative min-w-0 flex-1">
            <input
              class={`${INPUT_CLASS} w-full pr-8`}
              type={apiKeyVisible ? "text" : "password"}
              placeholder="Paste your API key here"
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            />
            <button
              class="absolute inset-y-0 right-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-1 text-(--muted) hover:text-(--fg)"
              onClick={() => setApiKeyVisible(!apiKeyVisible)}
              title={apiKeyVisible ? "Hide" : "Show"}
            >
              {apiKeyVisible ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5c-1.2-2.9-4-5-7.5-5zm0 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 11.5c-1.93 0-3.5-1.57-3.5-3.5 0-.17.01-.33.04-.49l-.84-.84A4.47 4.47 0 003 8c1.12 2.7 3.8 4.5 7 4.5.65 0 1.27-.08 1.87-.22l-.65-.65A5.37 5.37 0 018 11.5zm4.96-.64l-.7-.7A4.49 4.49 0 0013 8c-1.12-2.7-3.8-4.5-7-4.5-.65 0-1.27.08-1.87.22L2.15 1.74l-.7.7 12.2 12.2.7-.7-1.39-2.08zM9.88 6.47L8.53 5.12A2.24 2.24 0 019.88 6.47z"/></svg>
              )}
            </button>
          </div>
          <button class={ICON_BUTTON_CLASS} onClick={handleSaveApiKey} disabled={!apiKey.trim()} title="Save API key">
            <SaveIcon />
          </button>
        </div>
        {settings.hasApiKey && <span class={HINT_CLASS}>An API key is already configured.</span>}
      </div>

      <div class={SECTION_CLASS}>
        <label class={LABEL_CLASS}>Kilocode Database Path</label>
        <div class={ACTION_ROW_CLASS}>
          <input
            class={`${INPUT_CLASS} cursor-default opacity-80 focus:border-(--border)`}
            type="text"
            value={settings.databasePath}
            readOnly
          />
          <button class={ICON_BUTTON_CLASS} onClick={() => navigator.clipboard.writeText(settings.databasePath)} title="Copy path">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h6v1H4V4zm0 3h6v1H4V7zm0 3h4v1H4v-1zm8.5-8H5.5A1.5 1.5 0 004 3.5v7A1.5 1.5 0 005.5 12h7a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0012.5 2zm.5 8.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5h7a.5.5 0 01.5.5v7zM2 5.5A1.5 1.5 0 013.5 4H3v8.5a.5.5 0 00.5.5H12v.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 13.5v-8z"/></svg>
          </button>
        </div>
        <span class={HINT_CLASS}>Token usage data is read from this SQLite database.</span>
      </div>

      <div class={SECTION_CLASS}>
        <label class={LABEL_CLASS}>Refresh Interval (minutes)</label>
        <div class={ACTION_ROW_CLASS}>
          <input
            class={INPUT_CLASS}
            type="text"
            inputMode="numeric"
            value={refreshInterval}
            onInput={(e) => setRefreshInterval((e.target as HTMLInputElement).value.replace(/\D/g, ""))}
          />
          <button class={ICON_BUTTON_CLASS} onClick={handleSaveInterval} disabled={Number(refreshInterval) < 1} title="Save interval">
            <SaveIcon />
          </button>
        </div>
        <span class={HINT_CLASS}>How often to automatically refresh quota data.</span>
      </div>
    </div>
  );
}

export { SettingsPanel };

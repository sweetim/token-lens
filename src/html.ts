import type { DayTokens, ModelCost, ProjectDayTokens, ProjectTokens, QuotaSummary } from "./types.js";
import * as vscode from "vscode";
import { buildWebviewRenderData } from "./webview/data.js";
import { buildWebviewDocument } from "./webview/document.js";
import { buildDailyLineChart, buildGlobalCostTab, buildProjectCards, buildQuotaSection } from "./webview/sections.js";
import { formatTokens } from "./format.js";

async function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  projects: ProjectTokens[],
  days: DayTokens[],
  projectDays: ProjectDayTokens[],
  modelCosts: ModelCost[],
  quotaSummary?: QuotaSummary,
): Promise<string> {
  const renderData = await buildWebviewRenderData(projects, days, projectDays, modelCosts);
  const projectCards = buildProjectCards({
    modelCosts,
    modelData: renderData.modelData,
    projectChartConfigs: renderData.webviewData.projectCharts,
    projectDaysByProject: renderData.projectDaysByProject,
    projects,
  });
  const dailyGraphHtml = buildDailyLineChart(days, renderData.webviewData.dailyCharts);
  const globalCostHtml = buildGlobalCostTab(renderData.grandTokens, renderData.modelData);

  const bodyHtml = `${buildQuotaSection(quotaSummary)}
  <div class="hero">
    <div class="hero-title">Kilo Total Token Usage</div>
    <div class="hero-grid">
      <div class="hero-stat">
        <span class="val today">${formatTokens(renderData.todayTotalTokens)}</span>
        <span class="lbl">Today</span>
      </div>
      <div class="hero-stat">
        <span class="val tokens">${formatTokens(renderData.grandTotal)}</span>
        <span class="lbl">Total</span>
      </div>
      <div class="hero-stat">
        <span class="val cost">$${renderData.grandCost.toFixed(2)}</span>
        <span class="lbl">Costs</span>
      </div>
      <div class="hero-stat">
        <span class="val steps">${renderData.grandSteps}</span>
        <span class="lbl">Steps</span>
      </div>
    </div>
  </div>
  ${renderData.hasData ? `
  <div class="tabs">
    <button class="tab ${renderData.defaultTab === "projects" ? "active" : ""}" data-tab="projects">Projects</button>
    <button class="tab ${renderData.defaultTab === "daily" ? "active" : ""}" data-tab="daily">Daily</button>
    <button class="tab" data-tab="cost">$</button>
  </div>
  <div class="tab-content ${renderData.defaultTab === "projects" ? "active" : ""}" id="tab-projects">
    ${renderData.hasProjects ? `<div class="cards">${projectCards}</div>` : '<p class="empty">No project token usage data found.</p>'}
  </div>
  <div class="tab-content ${renderData.defaultTab === "daily" ? "active" : ""}" id="tab-daily">
    ${renderData.hasDays ? `
    <div class="daily-layout">
      <div class="daily-toolbar">
        <div class="view-toggle" role="tablist" aria-label="Daily view mode">
          <button class="view-toggle-button active" data-daily-view="cards" type="button" aria-label="Cards"><svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg></button>
          <button class="view-toggle-button" data-daily-view="graph" type="button" aria-label="Graph"><svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14L5.5 8L8.5 10.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
      <div class="daily-view active" id="daily-view-cards">
        <div class="vlist-scroll" id="daily-scroll">
          <div class="vlist-spacer" id="daily-spacer-top"></div>
          <div id="daily-viewport"></div>
          <div class="vlist-spacer" id="daily-spacer-bottom"></div>
        </div>
      </div>
      <div class="daily-view daily-graph-view" id="daily-view-graph">
        ${dailyGraphHtml}
      </div>
    </div>` : '<p class="empty">No daily token usage data found.</p>'}
  </div>
  <div class="tab-content" id="tab-cost">
    ${globalCostHtml}
  </div>` : '<p class="empty">No token usage data found.<br>Make sure Kilo is installed and ~/.local/share/kilo/kilo.db exists.</p>'}`;

  return buildWebviewDocument({
    bodyHtml,
    extensionUri,
    webview,
    webviewData: renderData.webviewData,
  });
}

export { getHtml };

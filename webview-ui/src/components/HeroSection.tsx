import type { HeroStatsData } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";

function HeroSection({ hero }: { hero: HeroStatsData }) {
  return (
    <div class="hero">
      <div class="hero-title">Kilo Total Token Usage</div>
      <div class="hero-grid">
        <div class="hero-stat"><span class="val today">{formatTokensCompact(hero.todayTokens)}</span><span class="lbl">Today</span></div>
        <div class="hero-stat"><span class="val tokens">{formatTokensCompact(hero.totalTokens)}</span><span class="lbl">Total</span></div>
        <div class="hero-stat"><span class="val cost">${hero.totalCost.toFixed(2)}</span><span class="lbl">Costs</span></div>
        <div class="hero-stat"><span class="val steps">{hero.totalSteps}</span><span class="lbl">Steps</span></div>
      </div>
    </div>
  );
}

export { HeroSection };

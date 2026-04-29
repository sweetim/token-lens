import type { HeroStatsData } from "@shared/webview-contract";
import { formatTokensCompact } from "@/view-helpers";

const HERO_STAT_CLASS = "flex flex-col gap-0.5";
const HERO_VALUE_CLASS = "text-lg font-bold leading-[1.1] tabular-nums";
const HERO_LABEL_CLASS = "text-[10px] uppercase tracking-[.5px] text-(--muted)";

function HeroSection({ hero }: { hero: HeroStatsData }) {
  return (
    <div class="border-b border-(--border) bg-(--card-bg) px-3.5 pt-4 pb-3.5">
      <div class="mb-2.5 text-[11px] uppercase tracking-[1px] text-(--muted)">Total Token Usage</div>
      <div class="grid grid-cols-4 gap-2">
        <div class={HERO_STAT_CLASS}><span class={`${HERO_VALUE_CLASS} text-(--accent2)`}>{formatTokensCompact(hero.todayTokens)}</span><span class={HERO_LABEL_CLASS}>Today</span></div>
        <div class={HERO_STAT_CLASS}><span class={`${HERO_VALUE_CLASS} text-(--accent)`}>{formatTokensCompact(hero.totalTokens)}</span><span class={HERO_LABEL_CLASS}>Total</span></div>
        <div class={HERO_STAT_CLASS}><span class={`${HERO_VALUE_CLASS} text-(--green)`}>${hero.totalCost.toFixed(2)}</span><span class={HERO_LABEL_CLASS}>Costs</span></div>
        <div class={HERO_STAT_CLASS}><span class={`${HERO_VALUE_CLASS} text-(--orange)`}>{hero.totalSessions}</span><span class={HERO_LABEL_CLASS}>Sessions</span></div>
      </div>
    </div>
  );
}

export { HeroSection };

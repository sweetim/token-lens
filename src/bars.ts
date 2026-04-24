const SEG_COLORS = {
  input: "#3794ff",
  output: "#89d185",
  reasoning: "#b180d7",
  cacheRead: "#d18616",
  cacheWrite: "#4ec9b0",
};

function stackedBarHtml(total: number, segments: Array<{ value: number; color: string }>): string {
  if (total <= 0) {
    return '<div class="card-bar-track"></div>';
  }
  const parts = segments
    .filter((s) => s.value > 0)
    .map((s) => `<div class="card-bar-seg" style="width:${((s.value / total) * 100).toFixed(1)}%;background:${s.color}"></div>`)
    .join("");
  return `<div class="card-bar-track">${parts}</div>`;
}

export { SEG_COLORS, stackedBarHtml };

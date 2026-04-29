function formatTokensCompact(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return String(value);
}

function normalizeModelNameForMatch(modelId: string): string {
  return modelId.replace(/^[^/]+\//, "").replace(/(\d)-(\d)/g, "$1.$2");
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? days + "d " + remainingHours + "h" : days + "d";
  }
  return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
}

export { formatTokensCompact, normalizeModelNameForMatch, formatDurationMs };

function formatDurationMs(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1) + "K";
  }
  return String(n);
}

import dayjs from "dayjs";

function formatDay(iso: string): string {
  const now = dayjs();
  const today = now.format("YYYY-MM-DD");
  const yesterday = now.subtract(1, "day").format("YYYY-MM-DD");
  if (iso === today) {
    return "Today";
  }
  if (iso === yesterday) {
    return "Yesterday";
  }
  return dayjs(iso).format("MMM D");
}

export { formatTokens, formatDay, formatDurationMs };

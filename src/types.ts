type ProjectTokens = {
  project: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  steps: number;
  sessions: number;
  duration: number;
};

type DayTokens = {
  day: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  steps: number;
  sessions: number;
  duration: number;
};

type ProjectDayTokens = {
  project: string;
  day: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  steps: number;
  sessions: number;
  duration: number;
};

type QuotaSummary = {
  usedTokens: number;
  limitTokens: number;
  remainingTokens: number;
  usedPercentage: number;
  remainingPercentage: number;
  nextResetTime: number;
  resetTimeLabel: string;
  resetDurationLabel: string;
};

export { ProjectTokens, DayTokens, ProjectDayTokens, QuotaSummary };

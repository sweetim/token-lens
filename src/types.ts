type ModelUsage = {
  model: string;
  provider: string;
  steps: number;
  totalTokens: number;
  totalCost: number;
};

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
  models: ModelUsage[];
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
  models: ModelUsage[];
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

type ModelCost = {
  project: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
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

export { ProjectTokens, DayTokens, ProjectDayTokens, ModelCost, ModelUsage, QuotaSummary };

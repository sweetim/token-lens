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
};

export { ProjectTokens, DayTokens };

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

const ALLOWED_PROVIDERS = new Set(["openai", "deepseek", "moonshotai", "anthropic", "z-ai", "qwen", "minimax"]);

const PROVIDER_ID_MAP: Record<string, string> = {
  openai: "openai",
  deepseek: "deepseek",
  moonshotai: "moonshotai",
  anthropic: "anthropic",
  zai: "z-ai",
  qwen: "qwen",
  minimax: "minimax",
};

type ModelData = {
  createdDates: Record<string, number>;
  pricing: Record<string, { prompt: number; completion: number }>;
};

type OpenRouterModel = {
  id: string;
  created: number;
  pricing: { prompt: string; completion: string };
};

let cachedData: ModelData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

function toOpenRouterModelId(provider: string, model: string): string {
  if (model.includes("/")) {
    return model.replace(/:.*$/, "");
  }
  const prefix = PROVIDER_ID_MAP[provider];
  return prefix ? `${prefix}/${model}` : `${provider}/${model}`;
}

async function fetchModelData(): Promise<ModelData> {
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedData;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      return cachedData ?? { createdDates: {}, pricing: {} };
    }
    const body = await response.json() as { data: OpenRouterModel[] };
    const models = body.data;

    const createdDates: Record<string, number> = {};
    const pricing: Record<string, { prompt: number; completion: number }> = {};

    for (const model of models) {
      const id = model.id.replace(/:.*$/, "");
      createdDates[id] = model.created;
      const promptPrice = Number(model.pricing.prompt);
      const completionPrice = Number(model.pricing.completion);
      pricing[id] = { prompt: promptPrice, completion: completionPrice };
    }

    cachedData = { createdDates, pricing };
    cacheTimestamp = now;
    return cachedData;
  } catch {
    return cachedData ?? { createdDates: {}, pricing: {} };
  }
}

export { THREE_MONTHS_MS, ALLOWED_PROVIDERS, PROVIDER_ID_MAP, toOpenRouterModelId, fetchModelData };
export type { ModelData };

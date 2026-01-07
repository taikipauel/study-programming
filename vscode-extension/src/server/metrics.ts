export type MetricsEvent = {
  operation: "rewrite" | "summarize" | "explain" | "suggest";
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUSD?: number;
  cacheHit?: boolean;
  summaryReused?: boolean;
  timestamp: number;
};

export type MetricsSnapshot = {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  cacheHitCount: number;
  summaryReuseCount: number;
  cacheHitRate: number;
  summaryReuseRate: number;
  cacheHitThreshold: number;
  summaryReuseThreshold: number;
  byOperation: Record<MetricsEvent["operation"], number>;
};

const metrics: MetricsEvent[] = [];

type ReuseThresholds = {
  cacheHitRate: number;
  summaryReuseRate: number;
};

const DEFAULT_REUSE_THRESHOLDS: ReuseThresholds = {
  cacheHitRate: 0.3,
  summaryReuseRate: 0.25,
};

let cachedThresholds: ReuseThresholds | null = null;

const loadReuseThresholds = (): ReuseThresholds => {
  if (cachedThresholds) {
    return cachedThresholds;
  }

  try {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const configPath = resolve(process.cwd(), "config", "performance.json");
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { reuseThresholds?: Partial<ReuseThresholds> };
    const thresholds = parsed.reuseThresholds ?? {};
    cachedThresholds = {
      cacheHitRate: thresholds.cacheHitRate ?? DEFAULT_REUSE_THRESHOLDS.cacheHitRate,
      summaryReuseRate: thresholds.summaryReuseRate ?? DEFAULT_REUSE_THRESHOLDS.summaryReuseRate,
    };
    return cachedThresholds;
  } catch {
    cachedThresholds = { ...DEFAULT_REUSE_THRESHOLDS };
    return cachedThresholds;
  }
};

export const recordMetrics = (event: MetricsEvent): void => {
  metrics.push(event);
};

export const getMetricsSnapshot = (): MetricsSnapshot => {
  const thresholds = loadReuseThresholds();
  const snapshot: MetricsSnapshot = {
    totalRequests: metrics.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    cacheHitCount: 0,
    summaryReuseCount: 0,
    cacheHitRate: 0,
    summaryReuseRate: 0,
    cacheHitThreshold: thresholds.cacheHitRate,
    summaryReuseThreshold: thresholds.summaryReuseRate,
    byOperation: {
      rewrite: 0,
      summarize: 0,
      explain: 0,
      suggest: 0,
    },
  };

  for (const event of metrics) {
    snapshot.totalInputTokens += event.inputTokens;
    snapshot.totalOutputTokens += event.outputTokens;
    snapshot.totalCostUSD += event.costUSD ?? 0;
    snapshot.byOperation[event.operation] += 1;
    if (event.cacheHit) {
      snapshot.cacheHitCount += 1;
    }
    if (event.summaryReused) {
      snapshot.summaryReuseCount += 1;
    }
  }

  if (snapshot.totalRequests > 0) {
    snapshot.cacheHitRate = snapshot.cacheHitCount / snapshot.totalRequests;
    snapshot.summaryReuseRate = snapshot.summaryReuseCount / snapshot.totalRequests;
  }

  return snapshot;
};

export const resetMetrics = (): void => {
  metrics.splice(0, metrics.length);
};

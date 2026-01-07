export type MetricsEvent = {
  operation: "rewrite" | "summarize" | "explain" | "suggest";
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUSD?: number;
  timestamp: number;
};

export type MetricsSnapshot = {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  byOperation: Record<MetricsEvent["operation"], number>;
};

const metrics: MetricsEvent[] = [];

export const recordMetrics = (event: MetricsEvent): void => {
  metrics.push(event);
};

export const getMetricsSnapshot = (): MetricsSnapshot => {
  const snapshot: MetricsSnapshot = {
    totalRequests: metrics.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
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
  }

  return snapshot;
};

export const resetMetrics = (): void => {
  metrics.splice(0, metrics.length);
};

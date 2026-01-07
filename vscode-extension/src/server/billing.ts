const DEFAULT_COST_PER_1K_TOKENS_USD = 0.002;

export type BillingSummary = {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
};

export const estimateCostUSD = (
  inputTokens: number,
  outputTokens: number,
  costPer1KTokensUSD: number = DEFAULT_COST_PER_1K_TOKENS_USD,
): number => {
  const totalTokens = inputTokens + outputTokens;
  return (totalTokens / 1000) * costPer1KTokensUSD;
};

export const buildBillingSummary = (
  inputTokens: number,
  outputTokens: number,
  costPer1KTokensUSD?: number,
): BillingSummary => {
  const costUSD = estimateCostUSD(
    inputTokens,
    outputTokens,
    costPer1KTokensUSD ?? DEFAULT_COST_PER_1K_TOKENS_USD,
  );

  return {
    inputTokens,
    outputTokens,
    costUSD,
  };
};

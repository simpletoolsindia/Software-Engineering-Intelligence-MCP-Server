// Token counter utility - estimates token usage to help minimize context usage

/**
 * Rough token estimation: ~4 chars per token for English text
 * This is a fast approximation — good enough for budgeting purposes.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Words count more accurately: avg 1.3 tokens per word
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const chars = text.length;
  // Use the average of char-based and word-based estimates
  const charEstimate = Math.ceil(chars / 4);
  const wordEstimate = Math.ceil(words.length * 1.3);
  return Math.ceil((charEstimate + wordEstimate) / 2);
}

/**
 * Estimate tokens for a JSON-serializable object
 */
export function estimateObjectTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

/**
 * Truncate text to fit within a token budget
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const current = estimateTokens(text);
  if (current <= maxTokens) return text;

  // Estimate how many chars we can keep
  const charBudget = Math.floor(maxTokens * 4);
  return text.slice(0, charBudget) + '... [truncated]';
}

/**
 * Token budget summary for a response object
 */
export interface TokenBudgetSummary {
  estimated: number;
  withinBudget: boolean;
  budget: number;
  efficiency: number; // 0-1, higher = more efficient
}

export function checkTokenBudget(obj: unknown, budget: number = 2000): TokenBudgetSummary {
  const estimated = estimateObjectTokens(obj);
  return {
    estimated,
    withinBudget: estimated <= budget,
    budget,
    efficiency: Math.min(budget / Math.max(estimated, 1), 1)
  };
}

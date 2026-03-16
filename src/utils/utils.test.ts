// Tests for utility functions
import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateObjectTokens, truncateToTokenBudget, checkTokenBudget } from '../utils/token-counter.js';
import { formatList, formatCompact } from '../utils/formatter.js';

describe('token-counter', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens for a simple sentence', () => {
    const tokens = estimateTokens('Hello world this is a test');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it('estimates object tokens', () => {
    const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
    const tokens = estimateObjectTokens(obj);
    expect(tokens).toBeGreaterThan(0);
  });

  it('truncates to token budget', () => {
    const long = 'word '.repeat(500);
    const truncated = truncateToTokenBudget(long, 10);
    expect(truncated).toContain('[truncated]');
    expect(estimateTokens(truncated)).toBeLessThanOrEqual(50); // rough check
  });

  it('does not truncate short text', () => {
    const short = 'hello world';
    expect(truncateToTokenBudget(short, 1000)).toBe(short);
  });

  it('checks token budget correctly', () => {
    const summary = checkTokenBudget({ data: 'short' }, 2000);
    expect(summary.withinBudget).toBe(true);
    expect(summary.estimated).toBeGreaterThan(0);
    expect(summary.budget).toBe(2000);
  });

  it('detects out-of-budget objects', () => {
    const big = { data: 'x'.repeat(10000) };
    const summary = checkTokenBudget(big, 10);
    expect(summary.withinBudget).toBe(false);
  });
});

describe('formatter', () => {
  it('formats a list with minimal verbosity', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const result = formatList(items, 'minimal');
    expect(result).toContain('a');
    expect(result).toContain('+2 more');
  });

  it('formats a list with standard verbosity - shows up to 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => `item${i}`);
    const result = formatList(items, 'standard');
    expect(result).toContain('+5 more');
  });

  it('formats a list with detailed verbosity - shows all', () => {
    const items = ['a', 'b', 'c'];
    const result = formatList(items, 'detailed');
    expect(result).toBe('a, b, c');
  });

  it('formatCompact produces key=value pairs', () => {
    const result = formatCompact({ type: 'bug', confidence: 0.8, active: true });
    expect(result).toContain('type=bug');
    expect(result).toContain('confidence=0.8');
  });

  it('formatCompact skips undefined values', () => {
    const result = formatCompact({ type: 'bug', name: undefined });
    expect(result).not.toContain('name');
  });
});

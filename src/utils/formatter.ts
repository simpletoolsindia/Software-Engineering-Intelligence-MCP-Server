// Response formatter utility - applies verbosity filtering to tool responses
import { Verbosity } from '../core/types.js';

/**
 * Filter object fields based on verbosity level.
 * minimal: only include key fields
 * standard: include most fields
 * detailed: include everything
 */
export function filterByVerbosity<T extends object>(
  obj: T,
  verbosity: Verbosity,
  minimalFields: (keyof T)[],
  standardFields: (keyof T)[]
): Partial<T> {
  if (verbosity === 'detailed') {
    return obj;
  }

  const fields = verbosity === 'minimal' ? minimalFields : standardFields;
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Format a list of items, truncating if too many for the verbosity level
 */
export function formatList(
  items: string[],
  verbosity: Verbosity,
  label?: string
): string {
  const limits: Record<Verbosity, number> = {
    minimal: 3,
    standard: 10,
    detailed: items.length
  };
  const limit = limits[verbosity];
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;

  let result = shown.join(', ');
  if (remaining > 0) {
    result += ` (+${remaining} more)`;
  }
  return label ? `${label}: ${result}` : result;
}

/**
 * Format a compact summary string from key-value pairs
 */
export function formatCompact(pairs: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');
}

/**
 * Wrap a tool result with verbosity metadata for downstream use
 */
export interface VerboseResult<T> {
  data: T;
  verbosity: Verbosity;
  tokenEstimate?: number;
}

export function wrapResult<T>(data: T, verbosity: Verbosity): VerboseResult<T> {
  return { data, verbosity };
}

// Tests for documentation capability tools
import { describe, it, expect } from 'vitest';
import { docContextBuild, docUpdatePlan } from './documentation.js';

describe('docContextBuild - no index', () => {
  it('returns empty doc context when no repo indexed', async () => {
    const result = await docContextBuild({ feature: 'user authentication' });
    expect(result.featureSummary).toBe('');
    expect(result.codeReferences).toEqual([]);
    expect(result.examples).toEqual([]);
  });
});

describe('docUpdatePlan - no index', () => {
  it('returns empty plan when no repo indexed', async () => {
    const result = await docUpdatePlan({ changedFiles: ['src/auth.ts'] });
    expect(result.docsToUpdate).toEqual([]);
    expect(result.docsToCreate).toEqual([]);
    expect(result.sectionsToUpdate).toEqual([]);
    expect(result.examplesNeeded).toEqual([]);
  });

  it('handles empty changedFiles', async () => {
    const result = await docUpdatePlan({ changedFiles: [] });
    expect(result.docsToUpdate).toEqual([]);
    expect(result.docsToCreate).toEqual([]);
  });
});

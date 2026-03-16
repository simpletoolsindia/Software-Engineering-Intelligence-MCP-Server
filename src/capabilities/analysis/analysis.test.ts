// Tests for analysis capability tools
import { describe, it, expect } from 'vitest';
import { taskClassify, repoScopeFind, flowSummarize, bugTraceCompacts } from './analysis.js';

describe('taskClassify', () => {
  it('classifies a bug task', async () => {
    const result = await taskClassify({ task: 'fix the crash when login fails' });
    expect(result.types).toContain('bug');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.suggestedMode).toBe('planning');
    expect(result.nextTools.length).toBeGreaterThan(0);
  });

  it('classifies a feature task', async () => {
    const result = await taskClassify({ task: 'implement new user profile feature' });
    expect(result.types).toContain('feature');
    expect(result.suggestedMode).toBe('planning');
  });

  it('classifies a POC task', async () => {
    const result = await taskClassify({ task: 'create a prototype for the payment flow' });
    expect(result.types).toContain('poc');
  });

  it('classifies a documentation task', async () => {
    const result = await taskClassify({ task: 'write readme and docs for the API' });
    expect(result.types).toContain('documentation');
    expect(result.suggestedMode).toBe('documentation');
  });

  it('classifies an analysis task', async () => {
    const result = await taskClassify({ task: 'analyze how the authentication flow works' });
    expect(result.types).toContain('analysis');
  });

  it('defaults to analysis when no keywords match', async () => {
    const result = await taskClassify({ task: 'do the thing' });
    expect(result.types).toContain('analysis');
    expect(result.confidence).toBe(0.5);
  });

  it('normalizes confidence to max 1.0', async () => {
    const result = await taskClassify({ task: 'fix bug, implement feature, write docs for poc prototype' });
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});

describe('repoScopeFind - no index', () => {
  it('returns empty result when no repo is indexed', async () => {
    const result = await repoScopeFind({ task: 'test task', taskType: 'analysis' });
    expect(result.files).toEqual([]);
    expect(result.modules).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});

describe('flowSummarize - no index', () => {
  it('returns empty summary message when no repo indexed', async () => {
    const result = await flowSummarize({});
    expect(result.summary).toContain('No codebase indexed');
    expect(result.steps).toEqual([]);
  });
});

describe('bugTraceCompacts - no index', () => {
  it('returns empty result when no repo indexed', async () => {
    const result = await bugTraceCompacts({ symptom: 'null pointer error' });
    expect(result.likelyCauses).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});

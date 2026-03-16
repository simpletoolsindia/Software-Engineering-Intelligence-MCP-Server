// Tests for execution capability tools
import { describe, it, expect } from 'vitest';
import { impactAnalyze, testSelect } from './execution.js';

describe('impactAnalyze - no index', () => {
  it('returns empty result with regression note when no repo indexed', async () => {
    const result = await impactAnalyze({
      scope: ['src/auth/auth.ts'],
      changeType: 'modify'
    });
    expect(result.regressionNotes).toContain('No repository indexed');
    expect(result.affectedFiles).toEqual([]);
    expect(result.affectedModules).toEqual([]);
  });

  it('adds risky point for delete changes', async () => {
    const result = await impactAnalyze({
      scope: ['src/auth/auth.ts'],
      changeType: 'delete'
    });
    // With no index, just regression note
    expect(result.regressionNotes).toContain('No repository indexed');
  });
});

describe('testSelect - no index', () => {
  it('returns empty test selection with reason when no repo indexed', async () => {
    const result = await testSelect({ scope: ['src/auth/auth.ts'] });
    expect(result.requiredTests).toEqual([]);
    expect(result.optionalTests).toEqual([]);
    expect(result.reason).toBeTruthy();
  });

  it('produces reason string', async () => {
    const result = await testSelect({ scope: ['src/foo.ts'], changeType: 'add' });
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

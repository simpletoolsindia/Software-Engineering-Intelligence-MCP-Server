// Tests for memory capability tools
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryCheckpoint, memoryRestore } from './memory.js';
import { getMemoryStore } from '../../memory/memory.js';

beforeEach(() => {
  // Clear memory between tests
  getMemoryStore().clear();
});

describe('memoryCheckpoint', () => {
  it('creates and stores a checkpoint', async () => {
    const result = await memoryCheckpoint({
      taskId: 'test-task-1',
      taskType: 'feature',
      files: ['src/foo.ts', 'src/bar.ts'],
      symbols: ['FooClass', 'barFunction'],
      modules: ['foo', 'bar'],
      decisions: [{ description: 'Use singleton pattern', rationale: 'Already in codebase' }],
      risks: ['Breaking change in bar.ts'],
      notes: 'Working on step 2'
    });

    expect(result.id).toMatch(/^cp_/);
    expect(result.taskId).toBe('test-task-1');
    expect(result.taskType).toBe('feature');
    expect(result.scope.files).toContain('src/foo.ts');
    expect(result.decisions.length).toBe(1);
    expect(result.risks).toContain('Breaking change in bar.ts');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('creates minimal checkpoint with required fields only', async () => {
    const result = await memoryCheckpoint({
      taskId: 'task-minimal',
      taskType: 'bug',
      files: ['src/auth.ts']
    });
    expect(result.id).toBeTruthy();
    expect(result.decisions).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.notes).toBe('');
  });
});

describe('memoryRestore', () => {
  it('restores a checkpoint by id', async () => {
    const checkpoint = await memoryCheckpoint({
      taskId: 'restore-test',
      taskType: 'analysis',
      files: ['src/index.ts'],
      pendingValidations: ['Check edge case'],
      pendingDocs: ['Update README']
    });

    const restored = await memoryRestore({ id: checkpoint.id });
    expect(restored).not.toBeNull();
    expect(restored!.checkpoint.taskId).toBe('restore-test');
    expect(restored!.unresolvedItems).toContain('Check edge case');
    expect(restored!.unresolvedItems).toContain('Update README');
    expect(restored!.progressSummary).toContain('analysis');
  });

  it('restores latest checkpoint by taskId', async () => {
    // Create two checkpoints - with a small delay so the second has a later timestamp
    await memoryCheckpoint({ taskId: 'multi-cp', taskType: 'feature', files: ['a.ts'] });
    await new Promise(r => setTimeout(r, 5)); // ensure different ms timestamps
    const second = await memoryCheckpoint({ taskId: 'multi-cp', taskType: 'feature', files: ['b.ts'] });

    const restored = await memoryRestore({ taskId: 'multi-cp' });
    expect(restored).not.toBeNull();
    expect(restored!.checkpoint.id).toBe(second.id);
  });

  it('returns null for unknown id', async () => {
    const result = await memoryRestore({ id: 'does-not-exist' });
    expect(result).toBeNull();
  });

  it('returns null for unknown taskId', async () => {
    const result = await memoryRestore({ taskId: 'no-such-task' });
    expect(result).toBeNull();
  });

  it('returns null when no id or taskId provided', async () => {
    const result = await memoryRestore({});
    expect(result).toBeNull();
  });
});

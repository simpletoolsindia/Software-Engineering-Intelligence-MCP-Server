// Tests for planning capability tools
import { describe, it, expect } from 'vitest';
import { implementationPlan, pocPlan } from './planning.js';

describe('implementationPlan', () => {
  it('creates a feature plan with steps', async () => {
    const result = await implementationPlan({
      task: 'add user profile endpoint',
      taskType: 'feature',
      scope: ['src/routes/user.ts', 'src/models/user.ts']
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.editTargets.length).toBeGreaterThan(0);
    expect(result.requiredTests.length).toBeGreaterThan(0);
    expect(result.requiredDocs).toContain('README.md');
    expect(result.handle).toMatch(/^plan_/);
  });

  it('creates a bug fix plan with risk notes', async () => {
    const result = await implementationPlan({
      task: 'fix null pointer in user auth',
      taskType: 'bug',
      scope: ['src/auth/auth.ts']
    });
    expect(result.riskNotes.length).toBeGreaterThan(0);
    expect(result.riskNotes[0]).toContain('regression');
  });

  it('includes a test creation step', async () => {
    const result = await implementationPlan({
      task: 'implement feature',
      taskType: 'feature',
      scope: ['src/foo.ts']
    });
    const testStep = result.steps.find(s => s.description.toLowerCase().includes('test'));
    expect(testStep).toBeDefined();
  });

  it('includes a documentation step for features', async () => {
    const result = await implementationPlan({
      task: 'implement feature',
      taskType: 'feature',
      scope: ['src/foo.ts']
    });
    const docStep = result.steps.find(s => s.description.toLowerCase().includes('doc'));
    expect(docStep).toBeDefined();
  });

  it('steps are in order', async () => {
    const result = await implementationPlan({
      task: 'implement feature',
      taskType: 'feature',
      scope: ['a.ts', 'b.ts']
    });
    for (let i = 0; i < result.steps.length - 1; i++) {
      expect(result.steps[i].order).toBeLessThan(result.steps[i + 1].order);
    }
  });
});

describe('pocPlan', () => {
  it('creates an API POC plan', async () => {
    const result = await pocPlan({ goal: 'prove the API endpoint can handle pagination' });
    expect(result.minimalArchitecture).toContain('Express');
    expect(result.shortcutsAllowed).toContain('Use in-memory storage');
    expect(result.handle).toMatch(/^poc_/);
  });

  it('creates a database POC plan', async () => {
    const result = await pocPlan({ goal: 'prove database storage works' });
    expect(result.minimalArchitecture).toContain('memory');
  });

  it('creates a UI POC plan', async () => {
    const result = await pocPlan({ goal: 'build a mockup for the user interface' });
    expect(result.shortcutsAllowed).toContain('Skip styling');
  });

  it('creates a generic POC plan', async () => {
    const result = await pocPlan({ goal: 'prove the algorithm is correct' });
    expect(result.filesToCreate.length).toBeGreaterThan(0);
    expect(result.mockStrategy).toBeTruthy();
  });

  it('respects constraints', async () => {
    const result = await pocPlan({
      goal: 'test the system',
      constraints: ['no auth required']
    });
    expect(result.excludedScope).toContain('Authentication');
  });
});

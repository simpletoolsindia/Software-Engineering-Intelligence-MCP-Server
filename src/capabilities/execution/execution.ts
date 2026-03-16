// Execution Capability Tools
import { z } from 'zod';
import {
  ImpactAnalysis,
  TestSelection,
  TestInfo,
  Verbosity
} from '../../core/types.js';
import { getIndexer } from '../../core/indexer/indexer.js';
import { getRetrievalEngine } from '../../core/retrieval/retriever.js';

// ============================================================================
// Impact Analyze
// ============================================================================

const ImpactAnalyzeSchema = z.object({
  scope: z.array(z.string()).describe('Files being changed'),
  changeType: z.enum(['add', 'modify', 'delete']).describe('Type of change')
});

export type ImpactAnalyzeParams = z.infer<typeof ImpactAnalyzeSchema>;

export async function impactAnalyze(params: ImpactAnalyzeParams, verbosity: Verbosity = 'minimal'): Promise<ImpactAnalysis> {
  const { scope, changeType } = params;

  const indexer = getIndexer();
  const index = indexer.getIndex();

  const affectedFiles: string[] = [];
  const affectedModules: string[] = [];
  const affectedSymbols: string[] = [];
  const regressionNotes: string[] = [];
  const riskyPoints: string[] = [];
  const relatedTests: string[] = [];
  const docsImpact: string[] = [];

  if (!index) {
    return {
      affectedFiles: [],
      affectedModules: [],
      affectedSymbols: [],
      regressionNotes: ['No repository indexed'],
      riskyPoints: [],
      relatedTests: [],
      docsImpact: []
    };
  }

  // Find affected files through import graph
  const retrieval = getRetrievalEngine();

  for (const filePath of scope) {
    // Get direct dependents
    const dependents = await retrieval.findDependents(filePath);
    for (const dep of dependents) {
      if (!affectedFiles.includes(dep.path)) {
        affectedFiles.push(dep.path);
      }
    }

    // Get related tests
    const tests = await retrieval.findRelatedTests(filePath);
    for (const test of tests) {
      if (!relatedTests.includes(test.path)) {
        relatedTests.push(test.path);
      }
    }

    // Extract module
    const module = filePath.split('/')[0];
    if (!affectedModules.includes(module)) {
      affectedModules.push(module);
    }
  }

  // Generate regression notes
  for (const file of affectedFiles) {
    const fileType = index.files.get(file)?.type;
    if (fileType === 'source') {
      regressionNotes.push(`Potential regression in: ${file}`);
    }
  }

  // Identify risky points
  if (changeType === 'delete') {
    riskyPoints.push('Removing files may break dependent code');
    riskyPoints.push('Check for exposed APIs that depend on deleted code');
  } else if (changeType === 'modify') {
    riskyPoints.push('Existing function signatures may affect callers');
    riskyPoints.push('Check for breaking changes in public exports');
  }

  // Find docs that might need updates
  for (const file of scope) {
    const module = file.split('/')[0];
    const moduleDocs = index.docs.filter(d => d.path.startsWith(module) || d.path.includes(module));
    for (const doc of moduleDocs) {
      if (!docsImpact.includes(doc.path)) {
        docsImpact.push(doc.path);
      }
    }
  }

  return {
    affectedFiles,
    affectedModules,
    affectedSymbols,
    regressionNotes,
    riskyPoints,
    relatedTests,
    docsImpact
  };
}

// ============================================================================
// Test Select
// ============================================================================

const TestSelectSchema = z.object({
  scope: z.array(z.string()).describe('Files being changed'),
  changeType: z.enum(['add', 'modify', 'delete']).optional().describe('Type of change'),
});

export type TestSelectParams = z.infer<typeof TestSelectSchema>;

export async function testSelect(params: TestSelectParams, verbosity: Verbosity = 'minimal'): Promise<TestSelection> {
  const { scope, changeType = 'modify' } = params;

  const retrieval = getRetrievalEngine();
  const requiredTests: TestInfo[] = [];
  const optionalTests: TestInfo[] = [];

  // Find tests for changed files
  for (const filePath of scope) {
    const tests = await retrieval.findRelatedTests(filePath);

    for (const test of tests) {
      // Map 'other' to 'unit' since TestInfo only accepts unit/integration/e2e
      const mappedType: 'unit' | 'integration' | 'e2e' = test.type === 'other' ? 'unit' : test.type;
      const testInfo: TestInfo = {
        path: test.path,
        type: mappedType,
        targetCoverage: [filePath]
      };

      // For modify/delete, tests are required
      if (changeType !== 'add') {
        if (!requiredTests.some(t => t.path === test.path)) {
          requiredTests.push(testInfo);
        }
      } else {
        if (!optionalTests.some(t => t.path === test.path)) {
          optionalTests.push(testInfo);
        }
      }
    }
  }

  // Generate reason
  let reason = `Found ${requiredTests.length} required and ${optionalTests.length} optional tests`;
  if (requiredTests.length === 0 && optionalTests.length === 0) {
    reason = 'No direct tests found - consider writing new tests for changes';
  }

  return {
    requiredTests,
    optionalTests,
    reason
  };
}

export const executionTools = {
  impact_analyze: {
    name: 'impact_analyze',
    description: 'Estimate blast radius of change',
    inputSchema: {
      type: 'object' as const,
      properties: {
        scope: { type: 'array', items: { type: 'string' }, description: 'Files being changed' },
        changeType: { type: 'string', enum: ['add', 'modify', 'delete'], description: 'Type of change' }
      },
      required: ['scope', 'changeType']
    },
    handler: impactAnalyze,
    schema: ImpactAnalyzeSchema
  },
  test_select: {
    name: 'test_select',
    description: 'Choose minimum useful test set',
    inputSchema: {
      type: 'object' as const,
      properties: {
        scope: { type: 'array', items: { type: 'string' }, description: 'Files being changed' },
        changeType: { type: 'string', enum: ['add', 'modify', 'delete'], description: 'Type of change' }
      },
      required: ['scope']
    },
    handler: testSelect,
    schema: TestSelectSchema
  }
};

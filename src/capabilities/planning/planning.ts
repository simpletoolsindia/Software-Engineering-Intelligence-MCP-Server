// Planning Capability Tools
import { z } from 'zod';
import {
  ImplementationPlan,
  POCPlan,
  PlanStep,
  EditTarget,
  Verbosity
} from '../../core/types.js';

// ============================================================================
// Implementation Plan
// ============================================================================

const ImplementationPlanSchema = z.object({
  task: z.string().describe('Feature or fix description'),
  taskType: z.enum(['feature', 'bug']).describe('Type of task'),
  scope: z.array(z.string()).describe('Files in scope'),
  existingPatterns: z.array(z.string()).optional().describe('Existing patterns to follow')
});

export type ImplementationPlanParams = z.infer<typeof ImplementationPlanSchema>;

export async function implementationPlan(params: ImplementationPlanParams, verbosity: Verbosity = 'minimal'): Promise<ImplementationPlan> {
  const { task, taskType, scope, existingPatterns = [] } = params;

  const steps: PlanStep[] = [];
  const editTargets: EditTarget[] = [];
  const requiredTests: string[] = [];
  const requiredDocs: string[] = [];
  const riskNotes: string[] = [];

  // Analyze scope and generate plan steps
  for (let i = 0; i < scope.length; i++) {
    const file = scope[i];

    if (taskType === 'feature') {
      steps.push({
        order: i + 1,
        description: `Implement in ${file}`,
        file,
        action: 'modify'
      });

      editTargets.push({
        file,
        description: `Add new functionality for: ${task}`
      });
    } else {
      // Bug fix
      steps.push({
        order: i + 1,
        description: `Fix bug in ${file}`,
        file,
        action: 'modify'
      });

      editTargets.push({
        file,
        description: `Address the bug: ${task}`
      });

      riskNotes.push(`Potential regression risk in ${file}`);
    }
  }

  // Add test creation step
  steps.push({
    order: steps.length + 1,
    description: 'Create or update tests',
    file: scope[0] || 'test file',
    action: 'create',
    dependencies: steps.map(s => s.file)
  });

  requiredTests.push(`${scope[0] || 'source'}.test.ts`);

  // Add documentation step
  if (taskType === 'feature') {
    steps.push({
      order: steps.length + 1,
      description: 'Update documentation',
      file: 'docs',
      action: 'modify'
    });

    requiredDocs.push('README.md');
  }

  return {
    steps,
    editTargets,
    requiredTests,
    requiredDocs,
    riskNotes,
    handle: `plan_${Date.now()}`
  };
}

// ============================================================================
// POC Plan
// ============================================================================

const POCPlanSchema = z.object({
  goal: z.string().describe('POC goal description'),
  constraints: z.array(z.string()).optional().describe('Known constraints or limitations'),
  existingCode: z.array(z.string()).optional().describe('Existing code to leverage')
});

export type POCPlanParams = z.infer<typeof POCPlanSchema>;

export async function pocPlan(params: POCPlanParams, verbosity: Verbosity = 'minimal'): Promise<POCPlan> {
  const { goal, constraints = [], existingCode = [] } = params;

  // Generate minimal architecture based on goal
  let minimalArchitecture = 'Simple Node.js module';
  const filesToCreate: string[] = [];
  const shortcutsAllowed: string[] = [];
  const excludedScope: string[] = [];

  // Analyze goal and determine scope
  const goalLower = goal.toLowerCase();

  if (goalLower.includes('api') || goalLower.includes('endpoint')) {
    minimalArchitecture = 'Simple Express/ HTTP handler with minimal routing';
    filesToCreate.push('src/poc/handler.ts');
    shortcutsAllowed.push('Use in-memory storage');
    shortcutsAllowed.push('Skip authentication');
    excludedScope.push('Database integration');
    excludedScope.push('Complex validation');
  } else if (goalLower.includes('database') || goalLower.includes('storage')) {
    minimalArchitecture = 'In-memory or file-based storage';
    filesToCreate.push('src/poc/storage.ts');
    shortcutsAllowed.push('Skip connection pooling');
    excludedScope.push('Production database');
  } else if (goalLower.includes('ui') || goalLower.includes('interface')) {
    minimalArchitecture = 'Minimal UI component';
    filesToCreate.push('src/poc/Component.tsx');
    shortcutsAllowed.push('Skip styling');
    shortcutsAllowed.push('Use mock data');
  } else {
    minimalArchitecture = 'Simple module with core logic';
    filesToCreate.push('src/poc/index.ts');
    shortcutsAllowed.push('Skip error handling');
    shortcutsAllowed.push('Skip logging');
  }

  // Add constraint-based exclusions
  for (const constraint of constraints) {
    const constraintLower = constraint.toLowerCase();
    if (constraintLower.includes('no auth')) {
      excludedScope.push('Authentication');
    }
    if (constraintLower.includes('simple')) {
      excludedScope.push('Advanced features');
    }
  }

  const mockStrategy = 'Use hardcoded test data and in-memory implementations';

  return {
    goal,
    minimalArchitecture,
    filesToCreate,
    shortcutsAllowed,
    excludedScope,
    mockStrategy,
    handle: `poc_${Date.now()}`
  };
}

export const planningTools = {
  implementation_plan: {
    name: 'implementation_plan',
    description: 'Build implementation plan for new feature or fix',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task: { type: 'string', description: 'Feature or fix description' },
        taskType: { type: 'string', enum: ['feature', 'bug'], description: 'Type of task' },
        scope: { type: 'array', items: { type: 'string' }, description: 'Files in scope' },
        existingPatterns: { type: 'array', items: { type: 'string' }, description: 'Existing patterns to follow' }
      },
      required: ['task', 'taskType', 'scope']
    },
    handler: implementationPlan,
    schema: ImplementationPlanSchema
  },
  poc_plan: {
    name: 'poc_plan',
    description: 'Define minimum viable POC implementation',
    inputSchema: {
      type: 'object' as const,
      properties: {
        goal: { type: 'string', description: 'POC goal description' },
        constraints: { type: 'array', items: { type: 'string' }, description: 'Known constraints' },
        existingCode: { type: 'array', items: { type: 'string' }, description: 'Existing code to leverage' }
      },
      required: ['goal']
    },
    handler: pocPlan,
    schema: POCPlanSchema
  }
};

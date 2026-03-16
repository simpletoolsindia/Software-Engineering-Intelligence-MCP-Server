// Analysis Capability Tools
import { z } from 'zod';
import {
  TaskClassification,
  TaskType,
  ScopeQuery,
  ScopedResult,
  FlowSummary,
  BugTraceResult,
  Verbosity
} from '../../core/types.js';
import { indexRepository, getIndexer } from '../../core/indexer/indexer.js';
import { getRetrievalEngine } from '../../core/retrieval/retriever.js';
import { getSummarizationEngine } from '../../core/summarizer/summarizer.js';

// ============================================================================
// Task Classification
// ============================================================================

const TaskClassifySchema = z.object({
  task: z.string().describe('The engineering task description to classify'),
  keywords: z.array(z.string()).optional().describe('Optional keywords for context')
});

export type TaskClassifyParams = z.infer<typeof TaskClassifySchema>;

export async function taskClassify(params: TaskClassifyParams, verbosity: Verbosity = 'minimal'): Promise<TaskClassification> {
  const { task, keywords = [] } = params;
  const taskLower = task.toLowerCase();

  // Detect task types from content
  const detectedTypes: TaskType[] = [];
  let confidence = 0;

  // Bug detection
  if (taskLower.includes('bug') || taskLower.includes('fix') || taskLower.includes('error') ||
      taskLower.includes('crash') || taskLower.includes('fail') || taskLower.includes('issue')) {
    detectedTypes.push('bug');
    confidence += 0.8;
  }

  // Feature detection
  if (taskLower.includes('implement') || taskLower.includes('add') || taskLower.includes('new') ||
      taskLower.includes('feature') || taskLower.includes('create')) {
    detectedTypes.push('feature');
    confidence += 0.7;
  }

  // POC detection
  if (taskLower.includes('poc') || taskLower.includes('proof of concept') ||
      taskLower.includes('prototype') || taskLower.includes('mockup')) {
    detectedTypes.push('poc');
    confidence += 0.9;
  }

  // Documentation detection
  if (taskLower.includes('doc') || taskLower.includes('readme') || taskLower.includes('comment') ||
      taskLower.includes('explain') || taskLower.includes('guide')) {
    detectedTypes.push('documentation');
    confidence += 0.8;
  }

  // Analysis detection
  if (taskLower.includes('analyze') || taskLower.includes('understand') || taskLower.includes('explain') ||
      taskLower.includes('how does') || taskLower.includes('what is')) {
    detectedTypes.push('analysis');
    confidence += 0.6;
  }

  // Default to analysis if nothing detected
  if (detectedTypes.length === 0) {
    detectedTypes.push('analysis');
    confidence = 0.5;
  }

  // Determine suggested mode
  let suggestedMode: TaskClassification['suggestedMode'] = 'analysis';
  if (detectedTypes.includes('bug') || detectedTypes.includes('feature')) {
    suggestedMode = 'planning';
  } else if (detectedTypes.includes('documentation')) {
    suggestedMode = 'documentation';
  }

  // Determine next tools
  const nextTools: string[] = [];
  if (suggestedMode === 'analysis') {
    nextTools.push('repo_scope_find', 'flow_summarize');
  } else if (suggestedMode === 'planning') {
    nextTools.push('repo_scope_find', 'implementation_plan');
  } else if (suggestedMode === 'documentation') {
    nextTools.push('doc_context_build', 'doc_update_plan');
  }

  // Normalize confidence
  confidence = Math.min(confidence, 1);

  return {
    types: detectedTypes,
    confidence,
    suggestedMode,
    nextTools
  };
}

// ============================================================================
// Repository Scope Find
// ============================================================================

const RepoScopeFindSchema = z.object({
  task: z.string().describe('The task description'),
  taskType: z.enum(['analysis', 'feature', 'bug', 'poc', 'documentation', 'mixed']).describe('Type of task'),
  keywords: z.array(z.string()).optional().describe('Additional keywords'),
  limit: z.number().optional().describe('Maximum results to return'),
  repoPath: z.string().optional().describe('Repository path to index (if not already indexed)')
});

export type RepoScopeFindParams = z.infer<typeof RepoScopeFindSchema>;

export async function repoScopeFind(params: RepoScopeFindParams, verbosity: Verbosity = 'minimal'): Promise<ScopedResult> {
  const { task, taskType, keywords = [], limit = 10, repoPath } = params;

  // Index repository if path provided
  if (repoPath) {
    await indexRepository(repoPath);
  }

  const retrieval = getRetrievalEngine();

  const query: ScopeQuery = {
    task,
    taskType,
    keywords,
    limit
  };

  return retrieval.findScope(query);
}

// ============================================================================
// Flow Summarize
// ============================================================================

const FlowSummarizeSchema = z.object({
  scope: z.array(z.string()).optional().describe('File paths to include in flow'),
  entryPoint: z.string().optional().describe('Entry point file'),
  verbosity: z.enum(['minimal', 'standard', 'detailed']).optional().describe('Verbosity level')
});

export type FlowSummarizeParams = z.infer<typeof FlowSummarizeSchema>;

export async function flowSummarize(params: FlowSummarizeParams, verbosity: Verbosity = 'minimal'): Promise<FlowSummary> {
  const summarizer = getSummarizationEngine();

  return summarizer.generateFlowSummary({
    scope: params.scope,
    entryPoint: params.entryPoint,
    verbosity: params.verbosity || verbosity
  });
}

// ============================================================================
// Bug Trace Compact
// ============================================================================

const BugTraceSchema = z.object({
  symptom: z.string().describe('Bug symptom description'),
  scope: z.array(z.string()).optional().describe('Files to investigate')
});

export type BugTraceParams = z.infer<typeof BugTraceSchema>;

export async function bugTraceCompacts(params: BugTraceParams, verbosity: Verbosity = 'minimal'): Promise<BugTraceResult> {
  const summarizer = getSummarizationEngine();

  return summarizer.traceBug(params.symptom, params.scope);
}

export const analysisTools = {
  task_classify: {
    name: 'task_classify',
    description: 'Classify an engineering task to determine its type and suggest next steps',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task: { type: 'string', description: 'The engineering task description to classify' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Optional keywords for context' }
      },
      required: ['task']
    },
    handler: taskClassify,
    schema: TaskClassifySchema
  },
  repo_scope_find: {
    name: 'repo_scope_find',
    description: 'Identify minimum relevant repository scope for a task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task: { type: 'string', description: 'The task description' },
        taskType: { type: 'string', enum: ['analysis', 'feature', 'bug', 'poc', 'documentation', 'mixed'], description: 'Type of task' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Additional keywords' },
        limit: { type: 'number', description: 'Maximum results to return' },
        repoPath: { type: 'string', description: 'Repository path to index' }
      },
      required: ['task', 'taskType']
    },
    handler: repoScopeFind,
    schema: RepoScopeFindSchema
  },
  flow_summarize: {
    name: 'flow_summarize',
    description: 'Explain existing implementation flow',
    inputSchema: {
      type: 'object' as const,
      properties: {
        scope: { type: 'array', items: { type: 'string' }, description: 'File paths to include' },
        entryPoint: { type: 'string', description: 'Entry point file' },
        verbosity: { type: 'string', enum: ['minimal', 'standard', 'detailed'], description: 'Verbosity level' }
      }
    },
    handler: flowSummarize,
    schema: FlowSummarizeSchema
  },
  bug_trace_compact: {
    name: 'bug_trace_compact',
    description: 'Trace likely bug causes from symptom description',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symptom: { type: 'string', description: 'Bug symptom description' },
        scope: { type: 'array', items: { type: 'string' }, description: 'Files to investigate' }
      },
      required: ['symptom']
    },
    handler: bugTraceCompacts,
    schema: BugTraceSchema
  }
};

// Memory Capability Tools
import { z } from 'zod';
import {
  MemoryCheckpoint,
  MemoryScope,
  MemoryDecision,
  MemoryRestoreResult,
  TaskType,
  Verbosity
} from '../../core/types.js';
import { getMemoryStore, createCheckpoint } from '../../memory/memory.js';

// ============================================================================
// Memory Checkpoint
// ============================================================================

const MemoryCheckpointSchema = z.object({
  taskId: z.string().describe('Unique task identifier'),
  taskType: z.enum(['analysis', 'feature', 'bug', 'poc', 'documentation', 'mixed']).describe('Type of task'),
  files: z.array(z.string()).describe('Files in scope'),
  symbols: z.array(z.string()).optional().describe('Symbols in scope'),
  modules: z.array(z.string()).optional().describe('Modules in scope'),
  decisions: z.array(z.object({
    description: z.string(),
    rationale: z.string()
  })).optional().describe('Decisions made'),
  risks: z.array(z.string()).optional().describe('Identified risks'),
  pendingValidations: z.array(z.string()).optional().describe('Pending validations'),
  pendingDocs: z.array(z.string()).optional().describe('Pending documentation'),
  notes: z.string().optional().describe('Additional notes')
});

export type MemoryCheckpointParams = z.infer<typeof MemoryCheckpointSchema>;

export async function memoryCheckpoint(params: MemoryCheckpointParams, verbosity: Verbosity = 'minimal'): Promise<MemoryCheckpoint> {
  const memory = getMemoryStore();

  const checkpointData = createCheckpoint({
    taskId: params.taskId,
    taskType: params.taskType,
    scope: {
      files: params.files,
      symbols: params.symbols || [],
      modules: params.modules || []
    },
    decisions: params.decisions?.map(d => ({
      ...d,
      timestamp: Date.now()
    })) || [],
    risks: params.risks || [],
    pendingValidations: params.pendingValidations || [],
    pendingDocs: params.pendingDocs || [],
    notes: params.notes || ''
  });

  return memory.saveCheckpoint(checkpointData);
}

// ============================================================================
// Memory Restore
// ============================================================================

const MemoryRestoreSchema = z.object({
  id: z.string().optional().describe('Checkpoint ID to restore'),
  taskId: z.string().optional().describe('Task ID to restore latest checkpoint')
});

export type MemoryRestoreParams = z.infer<typeof MemoryRestoreSchema>;

export async function memoryRestore(params: MemoryRestoreParams, verbosity: Verbosity = 'minimal'): Promise<MemoryRestoreResult | null> {
  const memory = getMemoryStore();

  let result: MemoryRestoreResult | null = null;

  if (params.id) {
    result = memory.restore(params.id);
  } else if (params.taskId) {
    const checkpoint = memory.getLatestForTask(params.taskId);
    if (checkpoint) {
      result = memory.restore(checkpoint.id);
    }
  }

  return result;
}

export const memoryTools = {
  memory_checkpoint: {
    name: 'memory_checkpoint',
    description: 'Store compact task state outside conversation context',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'Unique task identifier' },
        taskType: { type: 'string', enum: ['analysis', 'feature', 'bug', 'poc', 'documentation', 'mixed'], description: 'Type of task' },
        files: { type: 'array', items: { type: 'string' }, description: 'Files in scope' },
        symbols: { type: 'array', items: { type: 'string' }, description: 'Symbols in scope' },
        modules: { type: 'array', items: { type: 'string' }, description: 'Modules in scope' },
        decisions: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, rationale: { type: 'string' } } }, description: 'Decisions made' },
        risks: { type: 'array', items: { type: 'string' }, description: 'Identified risks' },
        pendingValidations: { type: 'array', items: { type: 'string' }, description: 'Pending validations' },
        pendingDocs: { type: 'array', items: { type: 'string' }, description: 'Pending documentation' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['taskId', 'taskType', 'files']
    },
    handler: memoryCheckpoint,
    schema: MemoryCheckpointSchema
  },
  memory_restore: {
    name: 'memory_restore',
    description: 'Restore compact previously saved task state',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Checkpoint ID to restore' },
        taskId: { type: 'string', description: 'Task ID to restore latest checkpoint' }
      }
    },
    handler: memoryRestore,
    schema: MemoryRestoreSchema
  }
};

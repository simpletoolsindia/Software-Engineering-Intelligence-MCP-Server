// Documentation Capability Tools
import { z } from 'zod';
import {
  DocContext,
  DocUpdatePlan,
  DocUpdate,
  DocCreate,
  Verbosity
} from '../../core/types.js';
import { getSummarizationEngine } from '../../core/summarizer/summarizer.js';
import { getIndexer } from '../../core/indexer/indexer.js';

// ============================================================================
// Doc Context Build
// ============================================================================

const DocContextBuildSchema = z.object({
  feature: z.string().optional().describe('Feature or change to document'),
  changedFiles: z.array(z.string()).optional().describe('Files that changed'),
  audience: z.enum(['junior', 'senior', 'pm', 'qa', 'api']).optional().describe('Target audience')
});

export type DocContextBuildParams = z.infer<typeof DocContextBuildSchema>;

export async function docContextBuild(params: DocContextBuildParams, verbosity: Verbosity = 'minimal'): Promise<DocContext> {
  const summarizer = getSummarizationEngine();

  return summarizer.buildDocContext({
    feature: params.feature,
    changedFiles: params.changedFiles,
    audience: params.audience
  });
}

// ============================================================================
// Doc Update Plan
// ============================================================================

const DocUpdatePlanSchema = z.object({
  changedFiles: z.array(z.string()).describe('Files that changed'),
  existingDocs: z.array(z.string()).optional().describe('Existing documentation files')
});

export type DocUpdatePlanParams = z.infer<typeof DocUpdatePlanSchema>;

export async function docUpdatePlan(params: DocUpdatePlanParams, verbosity: Verbosity = 'minimal'): Promise<DocUpdatePlan> {
  const { changedFiles, existingDocs = [] } = params;

  const indexer = getIndexer();
  const index = indexer.getIndex();

  const docsToUpdate: DocUpdate[] = [];
  const docsToCreate: DocCreate[] = [];
  const sectionsToUpdate: string[] = [];
  const examplesNeeded: string[] = [];

  if (!index) {
    return {
      docsToUpdate,
      docsToCreate,
      sectionsToUpdate,
      examplesNeeded
    };
  }

  // Find docs that reference changed modules
  const changedModules = new Set(changedFiles.map(f => f.split('/')[0]));

  for (const doc of index.docs) {
    const docModule = doc.path.split('/')[0];

    if (changedModules.has(docModule) || changedFiles.some(f => doc.path.includes(f))) {
      docsToUpdate.push({
        path: doc.path,
        reason: `References changed module: ${docModule}`
      });
      sectionsToUpdate.push(`${doc.name} - ${docModule} section`);
    }
  }

  // Check if we need new docs
  if (changedFiles.length > 0 && docsToUpdate.length === 0) {
    docsToCreate.push({
      path: 'docs/CHANGES.md',
      purpose: 'Document changes in changed files'
    });
  }

  // Determine examples needed
  for (const file of changedFiles.slice(0, 3)) {
    const fileName = file.split('/').pop() || '';
    if (fileName && !fileName.includes('test')) {
      examplesNeeded.push(`Example usage of ${fileName.replace(/\.[^.]+$/, '')}`);
    }
  }

  return {
    docsToUpdate,
    docsToCreate,
    sectionsToUpdate,
    examplesNeeded
  };
}

export const documentationTools = {
  doc_context_build: {
    name: 'doc_context_build',
    description: 'Build compact context for docs generation',
    inputSchema: {
      type: 'object' as const,
      properties: {
        feature: { type: 'string', description: 'Feature or change to document' },
        changedFiles: { type: 'array', items: { type: 'string' }, description: 'Files that changed' },
        audience: { type: 'string', enum: ['junior', 'senior', 'pm', 'qa', 'api'], description: 'Target audience' }
      }
    },
    handler: docContextBuild,
    schema: DocContextBuildSchema
  },
  doc_update_plan: {
    name: 'doc_update_plan',
    description: 'Identify which docs must change',
    inputSchema: {
      type: 'object' as const,
      properties: {
        changedFiles: { type: 'array', items: { type: 'string' }, description: 'Files that changed' },
        existingDocs: { type: 'array', items: { type: 'string' }, description: 'Existing docs' }
      },
      required: ['changedFiles']
    },
    handler: docUpdatePlan,
    schema: DocUpdatePlanSchema
  }
};

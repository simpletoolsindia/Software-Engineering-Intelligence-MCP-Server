// Summarization Layer - Generate compact summaries for code flows, bug traces, and docs
import * as fs from 'fs';
import * as path from 'path';
import {
  RepositoryIndex,
  FlowSummary,
  FlowStep,
  BugTraceResult,
  BugCause,
  DocContext,
  CodeReference,
  Example
} from '../types.js';
import { getIndexer } from '../indexer/indexer.js';
import { getRetrievalEngine } from '../retrieval/retriever.js';

export class SummarizationEngine {
  /**
   * Generate a flow summary for the codebase or specific files
   */
  async generateFlowSummary(options: {
    scope?: string[];
    entryPoint?: string;
    verbosity?: 'minimal' | 'standard' | 'detailed';
  }): Promise<FlowSummary> {
    const indexer = getIndexer();
    const index = indexer.getIndex();

    if (!index) {
      return this.emptyFlowSummary();
    }

    const files = options.scope
      ? options.scope.map(p => index.files.get(p)).filter(Boolean) as any[]
      : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 10);

    if (files.length === 0) {
      return this.emptyFlowSummary();
    }

    const steps: FlowStep[] = [];
    const keyFiles: string[] = [];
    const keySymbols: string[] = [];

    // Generate steps based on file analysis
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i === 0) {
        steps.push({
          order: 1,
          description: `Entry point: ${file.name}`,
          file: file.path
        });
      } else {
        // Analyze imports to determine flow
        const importedBy = this.getFilesImporting(file.path, index);

        if (importedBy.length > 0) {
          steps.push({
            order: steps.length + 1,
            description: `${file.name} is used by ${importedBy.length} file(s)`,
            file: file.path
          });
        } else {
          steps.push({
            order: steps.length + 1,
            description: `Dependency: ${file.name}`,
            file: file.path
          });
        }
      }

      keyFiles.push(file.path);

      // Extract key symbols
      const symbols = index.symbols.get(file.path) || [];
      for (const symbol of symbols.slice(0, 3)) {
        keySymbols.push(`${symbol.name} (${symbol.type})`);
      }
    }

    const summary = this.generateSummaryText(steps, options.verbosity || 'standard');

    return {
      summary,
      steps,
      keyFiles,
      keySymbols: keySymbols.slice(0, 10),
      entryPoint: options.entryPoint || files[0]?.path,
      handle: this.generateHandle('flow', files.map(f => f.path).join(','))
    };
  }

  /**
   * Trace likely bug causes from symptom description
   */
  async traceBug(symptom: string, scope?: string[]): Promise<BugTraceResult> {
    const indexer = getIndexer();
    const index = indexer.getIndex();

    if (!index) {
      return this.emptyBugTrace();
    }

    // Analyze symptom to find likely causes
    const likelyCauses: BugCause[] = [];
    const suspectFiles: string[] = [];
    const suspectSymbols: string[] = [];

    // Parse symptom keywords
    const symptomLower = symptom.toLowerCase();

    // Check for common bug patterns
    if (symptomLower.includes('null') || symptomLower.includes('undefined') || symptomLower.includes('cannot read')) {
      likelyCauses.push({
        description: 'Potential null/undefined access - check for missing null guards',
        likelihood: 0.8,
        type: 'null_undefined'
      });
    }

    if (symptomLower.includes('async') || symptomLower.includes('race') || symptomLower.includes('timing')) {
      likelyCauses.push({
        description: 'Potential race condition or async timing issue',
        likelihood: 0.7,
        type: 'race_condition'
      });
    }

    if (symptomLower.includes('type') || symptomLower.includes('cast')) {
      likelyCauses.push({
        description: 'Potential type mismatch or incorrect type assertion',
        likelihood: 0.6,
        type: 'type_mismatch'
      });
    }

    if (symptomLower.includes('loop') || symptomLower.includes('infinite')) {
      likelyCauses.push({
        description: 'Potential infinite loop or iteration issue',
        likelihood: 0.7,
        type: 'logic_error'
      });
    }

    // Find suspicious files in scope
    const targetFiles = scope
      ? scope.map(p => index.files.get(p)).filter(Boolean) as any[]
      : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 20);

    // Check files with many imports (complex dependencies)
    for (const file of targetFiles) {
      if (file.imports.length > 10) {
        suspectFiles.push(file.path);
      }
    }

    // Check files with complex logic (many exports)
    for (const file of targetFiles) {
      if (file.exports.length > 10) {
        suspectFiles.push(file.path);
      }
    }

    // Find suspicious symbols
    for (const [filePath, symbols] of index.symbols) {
      for (const symbol of symbols) {
        // Functions that could throw
        if (symbol.type === 'function' && !symbol.name.startsWith('get') && !symbol.name.startsWith('is')) {
          suspectSymbols.push(`${symbol.name} in ${filePath}`);
        }
      }
    }

    const confidence = Math.min(likelyCauses.length * 0.25 + 0.3, 0.9);

    return {
      likelyCauses,
      suspectFiles: suspectFiles.slice(0, 10),
      suspectSymbols: suspectSymbols.slice(0, 10),
      confidence,
      handle: this.generateHandle('bug', symptom)
    };
  }

  /**
   * Build documentation context for a feature or change
   */
  async buildDocContext(options: {
    feature?: string;
    changedFiles?: string[];
    audience?: string;
  }): Promise<DocContext> {
    const indexer = getIndexer();
    const index = indexer.getIndex();

    if (!index) {
      return this.emptyDocContext();
    }

    const featureSummary = options.feature || 'Codebase overview';
    const codeReferences: CodeReference[] = [];
    const examples: Example[] = [];

    // Find relevant code references
    const targetFiles = options.changedFiles
      ? options.changedFiles.map(p => index.files.get(p)).filter(Boolean) as any[]
      : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 5);

    for (const file of targetFiles) {
      const symbols = index.symbols.get(file.path) || [];

      codeReferences.push({
        file: file.path,
        description: `${file.exports.length} exports: ${file.exports.slice(0, 3).join(', ')}`
      });

      // Try to extract code examples
      if (file.exports.length > 0 && file.language === 'typescript') {
        try {
          const content = fs.readFileSync(path.join(index.rootPath, file.path), 'utf-8');
          const exampleCode = this.extractExampleCode(content, file.exports[0]);
          if (exampleCode) {
            examples.push({
              title: `Usage of ${file.exports[0]}`,
              code: exampleCode,
              language: file.language
            });
          }
        } catch {
          // Ignore errors
        }
      }
    }

    // Generate audience notes
    const audienceNotes: Record<string, string> = {};
    if (options.audience) {
      audienceNotes[options.audience] = this.generateAudienceNote(options.audience, codeReferences);
    } else {
      audienceNotes['developer'] = this.generateAudienceNote('developer', codeReferences);
    }

    const totalExports = codeReferences.reduce((sum, r) => {
      const match = r.description.match(/\d+/);
      return sum + (match ? parseInt(match[0], 10) : 0);
    }, 0);

    return {
      featureSummary,
      currentBehavior: `The codebase contains ${targetFiles.length} main source files with ${totalExports} total exports.`,
      codeReferences,
      examples: examples.slice(0, 3),
      audienceNotes,
      handle: this.generateHandle('doc', options.feature || 'overview')
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private emptyFlowSummary(): FlowSummary {
    return {
      summary: 'No codebase indexed. Use repo_scope_find to index a repository first.',
      steps: [],
      keyFiles: [],
      keySymbols: [],
      handle: undefined
    };
  }

  private emptyBugTrace(): BugTraceResult {
    return {
      likelyCauses: [],
      suspectFiles: [],
      suspectSymbols: [],
      confidence: 0,
      handle: undefined
    };
  }

  private emptyDocContext(): DocContext {
    return {
      featureSummary: '',
      currentBehavior: '',
      codeReferences: [],
      examples: [],
      audienceNotes: {},
      handle: undefined
    };
  }

  private generateSummaryText(steps: FlowStep[], verbosity: string): string {
    if (verbosity === 'minimal') {
      return `${steps.length} files in flow`;
    }

    if (steps.length === 0) {
      return 'No flow data available';
    }

    if (verbosity === 'standard') {
      const lines = steps.map(s => `${s.order}. ${s.description}`);
      return `Flow overview:\n${lines.join('\n')}`;
    }

    // Detailed
    const detailedLines = steps.map(s => `${s.order}. ${s.description} (${s.file})`);
    return `Code flow analysis (${steps.length} steps):\n\n${detailedLines.join('\n')}`;
  }

  private getFilesImporting(filePath: string, index: RepositoryIndex): string[] {
    const importers: string[] = [];

    for (const [path, file] of index.files) {
      if (file.imports.some(imp => imp === filePath || path.endsWith(imp))) {
        importers.push(path);
      }
    }

    return importers;
  }

  private generateHandle(prefix: string, data: string): string {
    // Simple hash-like handle
    const hash = data.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return `${prefix}_${Math.abs(hash).toString(36)}`;
  }

  private extractExampleCode(content: string, exportName: string): string | null {
    // Try to find a usage example of the exported symbol
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(exportName) && !line.startsWith('export')) {
        // Return a few lines around this
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        return lines.slice(start, end).join('\n');
      }
    }

    return null;
  }

  private generateAudienceNote(audience: string, references: CodeReference[]): string {
    switch (audience) {
      case 'junior':
        return `Start with the main entry points: ${references.slice(0, 2).map(r => r.file).join(', ')}. Focus on understanding the exports.`;
      case 'senior':
        return `Key files: ${references.map(r => r.file).join(', ')}. Review architecture patterns.`;
      default:
        return `${references.length} main files to review.`;
    }
  }
}

// Singleton instance
let summarizationInstance: SummarizationEngine | null = null;

export function getSummarizationEngine(): SummarizationEngine {
  if (!summarizationInstance) {
    summarizationInstance = new SummarizationEngine();
  }
  return summarizationInstance;
}
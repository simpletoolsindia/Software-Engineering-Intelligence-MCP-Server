// Summarization Layer - Metadata summaries augmented by RAG code snippets.
// Flow: metadata-only → RAG retrieves top-K relevant chunks → snippets embedded
// in steps/causes → richer output with near-zero extra token cost.
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
import { getRagEngine } from '../rag/rag.js';

// ── Token budget for RAG snippets ────────────────────────────────────────────
// These limits keep RAG from blowing up the output token count.
const FLOW_MAX_SNIPPETS  = 4;   // max chunks injected into a flow summary
const BUG_MAX_SNIPPETS   = 3;   // max chunks injected into a bug trace
const DOC_MAX_EXAMPLES   = 3;   // max code examples for doc context
const SNIPPET_MAX_LINES  = 10;  // each snippet capped at 10 lines

export class SummarizationEngine {

  // ── Flow Summary ────────────────────────────────────────────────────────────

  async generateFlowSummary(options: {
    scope?: string[];
    entryPoint?: string;
    verbosity?: 'minimal' | 'standard' | 'detailed';
  }): Promise<FlowSummary> {
    const index = getIndexer().getIndex();
    if (!index) return this.emptyFlowSummary();

    const files = options.scope
      ? options.scope.map(p => index.files.get(p)).filter(Boolean) as any[]
      : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 10);

    if (files.length === 0) return this.emptyFlowSummary();

    const verbosity = options.verbosity ?? 'standard';
    const steps: FlowStep[] = [];
    const keySymbols: string[] = [];

    // ── RAG: retrieve code chunks relevant to the scope ──────────────────────
    const scopePaths = files.map((f: any) => f.path);
    const scopeQuery = scopePaths.map((p: string) => path.basename(p, path.extname(p))).join(' ');
    const ragChunks  = getRagEngine().retrieve(scopeQuery, index, {
      files: scopePaths,
      topK:  FLOW_MAX_SNIPPETS,
    });
    // Build a map: file → best chunk for that file
    const bestChunk = new Map<string, string>();
    for (const c of ragChunks) {
      if (!bestChunk.has(c.file)) bestChunk.set(c.file, c.snippet);
    }

    // ── Build flow steps ─────────────────────────────────────────────────────
    for (let i = 0; i < files.length; i++) {
      const file       = files[i];
      const importedBy = this.getFilesImporting(file.path, index);

      // Describe the step from actual exports + import graph
      const topExports = file.exports.slice(0, 3).join(', ');
      let description: string;
      if (i === 0) {
        description = `Entry: ${file.name}` + (topExports ? ` — exports ${topExports}` : '');
      } else if (importedBy.length > 0) {
        description = `${file.name} used by ${importedBy.length} file(s)` + (topExports ? ` · exports ${topExports}` : '');
      } else {
        description = `${file.name}` + (topExports ? ` — exports ${topExports}` : '');
      }

      const step: FlowStep = {
        order:  i + 1,
        description,
        file:   file.path,
        symbol: file.exports[0],
      };

      // ── Attach RAG snippet for detailed / standard verbosity ─────────────
      if (verbosity !== 'minimal' && bestChunk.has(file.path)) {
        step.snippet = limitLines(bestChunk.get(file.path)!, SNIPPET_MAX_LINES);
      }

      steps.push(step);

      // Collect key symbols
      const symbols = index.symbols.get(file.path) ?? [];
      for (const sym of symbols.slice(0, 3)) keySymbols.push(`${sym.name} (${sym.type})`);
    }

    return {
      summary:    this.generateSummaryText(steps, verbosity),
      steps,
      keyFiles:   files.map((f: any) => f.path),
      keySymbols: keySymbols.slice(0, 12),
      entryPoint: options.entryPoint ?? files[0]?.path,
      handle:     this.generateHandle('flow', scopePaths.join(',')),
    };
  }

  // ── Bug Trace ───────────────────────────────────────────────────────────────

  async traceBug(symptom: string, scope?: string[]): Promise<BugTraceResult> {
    const index = getIndexer().getIndex();
    if (!index) return this.emptyBugTrace();

    const symptomLower = symptom.toLowerCase();
    const likelyCauses: BugCause[] = [];
    const suspectFiles  = new Set<string>();
    const suspectSymbols: string[] = [];

    // ── Pattern-based cause detection (same as before) ───────────────────────
    if (symptomLower.match(/null|undefined|cannot read|is not a function/)) {
      likelyCauses.push({ type: 'null_undefined', likelihood: 0.85,
        description: 'Null/undefined access — check for missing null guards before dereferencing' });
    }
    if (symptomLower.match(/race|timing|async|concurrent|await/)) {
      likelyCauses.push({ type: 'race_condition', likelihood: 0.75,
        description: 'Race condition or unresolved async — ensure all async paths are awaited' });
    }
    if (symptomLower.match(/type|cast|instanceof|assign/)) {
      likelyCauses.push({ type: 'type_mismatch', likelihood: 0.65,
        description: 'Type mismatch — verify type assertions and interface contracts' });
    }
    if (symptomLower.match(/loop|infinite|timeout|hang/)) {
      likelyCauses.push({ type: 'logic_error', likelihood: 0.70,
        description: 'Logic error in loop or termination condition' });
    }
    if (symptomLower.match(/state|stale|cache|invalidat/)) {
      likelyCauses.push({ type: 'unsafe_state', likelihood: 0.70,
        description: 'Stale or incorrectly invalidated state — check cache write-through and eviction' });
    }

    // ── RAG: find chunks that literally contain symptom keywords ─────────────
    const scopePaths = scope ?? [];
    const keywords   = extractKeywords(symptom);
    const ragByLit   = getRagEngine().retrieveByLiteral(keywords, index, {
      files: scopePaths.length > 0 ? scopePaths : undefined,
      topK:  BUG_MAX_SNIPPETS,
    });

    // ── RAG: semantic retrieval on the symptom text ──────────────────────────
    const ragBySem = getRagEngine().retrieve(symptom, index, {
      files: scopePaths.length > 0 ? scopePaths : undefined,
      topK:  BUG_MAX_SNIPPETS,
    });

    // Merge: literal hits first (higher relevance for bug tracing), then semantic
    const seen    = new Set<string>();
    const topRag  = [...ragByLit, ...ragBySem].filter(c => {
      const key = `${c.file}:${c.symbol}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, BUG_MAX_SNIPPETS);

    // ── Attach snippets to causes and build suspect lists ────────────────────
    for (let i = 0; i < topRag.length; i++) {
      const chunk = topRag[i];
      suspectFiles.add(chunk.file);
      suspectSymbols.push(`${chunk.symbol} in ${chunk.file}`);

      // Enrich the matching cause (or add a new one)
      if (i < likelyCauses.length) {
        likelyCauses[i].file    = chunk.file;
        likelyCauses[i].symbol  = chunk.symbol;
        likelyCauses[i].snippet = limitLines(chunk.snippet, SNIPPET_MAX_LINES);
      } else {
        // RAG found a relevant chunk not covered by pattern matching — add cause
        likelyCauses.push({
          type:        'other',
          likelihood:  Math.max(0.3, chunk.score),
          description: `Relevant code in ${chunk.symbol} (${chunk.file}) — ${chunk.reason}`,
          file:        chunk.file,
          symbol:      chunk.symbol,
          snippet:     limitLines(chunk.snippet, SNIPPET_MAX_LINES),
        });
      }
    }

    // Fallback: if RAG found nothing, add suspect files from index heuristics
    if (suspectFiles.size === 0) {
      const targetFiles = scope
        ? scope.map(p => index.files.get(p)).filter(Boolean) as any[]
        : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 20);
      for (const file of targetFiles) {
        if (file.imports.length > 10 || file.exports.length > 10) suspectFiles.add(file.path);
      }
    }

    const confidence = Math.min(likelyCauses.length * 0.2 + (topRag.length > 0 ? 0.25 : 0.1), 0.95);

    return {
      likelyCauses,
      suspectFiles:   [...suspectFiles].slice(0, 10),
      suspectSymbols: suspectSymbols.slice(0, 10),
      confidence,
      handle: this.generateHandle('bug', symptom),
    };
  }

  // ── Doc Context ─────────────────────────────────────────────────────────────

  async buildDocContext(options: {
    feature?: string;
    changedFiles?: string[];
    audience?: string;
  }): Promise<DocContext> {
    const index = getIndexer().getIndex();
    if (!index) return this.emptyDocContext();

    const featureSummary = options.feature ?? 'Codebase overview';
    const codeReferences: CodeReference[] = [];
    const examples: Example[] = [];

    const targetFiles = options.changedFiles
      ? options.changedFiles.map(p => index.files.get(p)).filter(Boolean) as any[]
      : Array.from(index.files.values()).filter(f => f.type === 'source').slice(0, 5);

    // ── Metadata: collect code references from index ─────────────────────────
    for (const file of targetFiles) {
      codeReferences.push({
        file: file.path,
        symbol: file.exports[0],
        description: `${file.exports.length} exports: ${file.exports.slice(0, 4).join(', ')}`,
      });
    }

    // ── RAG: retrieve usage examples via semantic search ─────────────────────
    const ragQuery  = featureSummary + ' ' + (options.changedFiles ?? []).map(f => path.basename(f, path.extname(f))).join(' ');
    const scopePaths = targetFiles.map((f: any) => f.path);
    const ragChunks  = getRagEngine().retrieve(ragQuery, index, {
      files: scopePaths,
      topK:  DOC_MAX_EXAMPLES,
    });

    for (const chunk of ragChunks) {
      const fileEntry = index.files.get(chunk.file);
      if (!fileEntry) continue;
      examples.push({
        title:    `${chunk.symbol} — ${chunk.file}`,
        code:     limitLines(chunk.snippet, SNIPPET_MAX_LINES),
        language: fileEntry.language,
      });
    }

    // ── Audience notes ───────────────────────────────────────────────────────
    const audienceNotes: Record<string, string> = {};
    const aud = options.audience ?? 'developer';
    audienceNotes[aud] = this.generateAudienceNote(aud, codeReferences);

    const totalExports = codeReferences.reduce((s, r) => {
      const m = r.description.match(/\d+/);
      return s + (m ? parseInt(m[0], 10) : 0);
    }, 0);

    return {
      featureSummary,
      currentBehavior: `${targetFiles.length} files · ${totalExports} total exports${ragChunks.length > 0 ? ` · ${ragChunks.length} code snippet(s) attached` : ''}`,
      codeReferences,
      examples: examples.slice(0, DOC_MAX_EXAMPLES),
      audienceNotes,
      handle: this.generateHandle('doc', options.feature ?? 'overview'),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private emptyFlowSummary(): FlowSummary {
    return { summary: 'No codebase indexed. Use repo_scope_find to index a repository first.', steps: [], keyFiles: [], keySymbols: [], handle: undefined };
  }

  private emptyBugTrace(): BugTraceResult {
    return { likelyCauses: [], suspectFiles: [], suspectSymbols: [], confidence: 0, handle: undefined };
  }

  private emptyDocContext(): DocContext {
    return { featureSummary: '', currentBehavior: '', codeReferences: [], examples: [], audienceNotes: {}, handle: undefined };
  }

  private generateSummaryText(steps: FlowStep[], verbosity: string): string {
    if (verbosity === 'minimal' || steps.length === 0) return `${steps.length} files in flow`;
    if (verbosity === 'standard') return `Flow overview:\n${steps.map(s => `${s.order}. ${s.description}`).join('\n')}`;
    return `Code flow (${steps.length} files):\n\n${steps.map(s => `${s.order}. ${s.description}\n   ${s.file}${s.snippet ? '\n' + indent(s.snippet, '   ') : ''}`).join('\n\n')}`;
  }

  private getFilesImporting(filePath: string, index: RepositoryIndex): string[] {
    const importers: string[] = [];
    for (const [p, file] of index.files) {
      if (file.imports.some(imp => imp === filePath || p.endsWith(imp))) importers.push(p);
    }
    return importers;
  }

  private generateHandle(prefix: string, data: string): string {
    const hash = data.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
    return `${prefix}_${Math.abs(hash).toString(36)}`;
  }

  private generateAudienceNote(audience: string, refs: CodeReference[]): string {
    switch (audience) {
      case 'junior':   return `Start with: ${refs.slice(0,2).map(r => r.file).join(', ')}. Focus on the exported functions.`;
      case 'senior':   return `Key files: ${refs.map(r => r.file).join(', ')}. Review architecture and side-effects.`;
      case 'api':      return `Public surface: ${refs.flatMap(r => r.description.replace(/^\d+ exports: /, '').split(', ')).slice(0,8).join(', ')}`;
      case 'pm':       return `${refs.length} components changed. Each exposes: ${refs.map(r => r.file.split('/').pop()).join(', ')}`;
      case 'qa':       return `Test entry points: ${refs.map(r => r.symbol ?? r.file).join(', ')}`;
      default:         return `${refs.length} main files to review.`;
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function limitLines(text: string, max: number): string {
  const lines = text.split('\n');
  return lines.length <= max ? text : lines.slice(0, max).join('\n') + '\n  // ...';
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map(l => prefix + l).join('\n');
}

function extractKeywords(text: string): string[] {
  // Pull out quoted strings, error codes (ALL_CAPS_WITH_UNDERSCORES), and long words
  const quoted    = [...text.matchAll(/'([^']+)'|"([^"]+)"/g)].map(m => m[1] ?? m[2]);
  const errCodes  = text.match(/[A-Z][A-Z0-9_]{3,}/g) ?? [];
  const words     = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 5);
  return [...new Set([...quoted, ...errCodes, ...words])].slice(0, 12);
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let summarizationInstance: SummarizationEngine | null = null;

export function getSummarizationEngine(): SummarizationEngine {
  if (!summarizationInstance) summarizationInstance = new SummarizationEngine();
  return summarizationInstance;
}

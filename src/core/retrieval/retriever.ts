// Retrieval and Ranking - Find relevant files, symbols, tests, and docs
import {
  ScopeQuery,
  ScopedResult,
  RankedFile,
  FileIndexEntry,
  SymbolIndexEntry,
  TestIndexEntry,
  DocIndexEntry
} from '../types.js';
import { getIndexer } from '../indexer/indexer.js';

// Stop words as module-level Set — created once, O(1) lookup
const STOP_WORDS = new Set([
  'function', 'class', 'method', 'variable', 'const', 'let', 'var',
  'return', 'import', 'export', 'async', 'await', 'the', 'and', 'for',
  'with', 'this', 'that', 'from', 'type', 'interface', 'new', 'not'
]);

export class RetrievalEngine {

  // ── Public API ─────────────────────────────────────────────────────────────

  async findScope(query: ScopeQuery): Promise<ScopedResult> {
    const index = getIndexer().getIndex();
    if (!index) return { files: [], modules: [], symbols: [], tests: [], docs: [], confidence: 0 };

    const limit    = query.limit || 10;
    const keywords = this.normalizeKeywords(query.task, query.keywords || []);

    // Pre-build module set from files for O(1) test-module checks
    const fileModuleMap = new Map<string, string>(); // filePath → module
    for (const [fp] of index.files) fileModuleMap.set(fp, fp.split('/')[0] ?? 'root');

    const rankedFiles = this.rankFiles(index.files, keywords, query.taskType);
    const topFiles    = rankedFiles.slice(0, limit).map(r => r.file);

    // Build a Set of top-file paths for O(1) membership tests downstream
    const topFilePathSet = new Set(topFiles.map(f => f.path));
    const topModules     = new Set(topFiles.map(f => f.path.split('/')[0] ?? 'root'));

    const [symbols, tests, docs] = [
      this.findRelevantSymbols(index.symbols, keywords, topFilePathSet),
      this.findRelevantTests(index.tests, topFiles, topModules),
      this.findRelevantDocs(index.docs, keywords, topModules)
    ];

    return {
      files:      topFiles,
      modules:    [...topModules],
      symbols,
      tests,
      docs,
      confidence: this.calculateConfidence(rankedFiles.slice(0, limit), keywords)
    };
  }

  async findByImport(importPath: string): Promise<FileIndexEntry | null> {
    const index = getIndexer().getIndex();
    if (!index) return null;

    // Build name→file map on first call if needed (O(1) lookups after)
    for (const [p, file] of index.files) {
      if (p === importPath || p.endsWith(importPath)) return file;
    }
    const importName = importPath.split('/').pop() || '';
    for (const [, file] of index.files) {
      if (file.name === importName) return file;
    }
    return null;
  }

  async findRelatedTests(filePath: string): Promise<TestIndexEntry[]> {
    const index = getIndexer().getIndex();
    if (!index) return [];

    const baseName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
    const dir      = filePath.substring(0, filePath.lastIndexOf('/'));
    const seen     = new Set<string>();
    const results: TestIndexEntry[] = [];

    for (const t of index.tests) {
      if (seen.has(t.path)) continue;
      if (t.targetFile === filePath || t.name.includes(baseName)) {
        results.push(t);
        seen.add(t.path);
      }
    }
    for (const t of index.tests) {
      if (!seen.has(t.path) && t.path.startsWith(dir)) {
        results.push(t);
        seen.add(t.path);
      }
    }
    return results;
  }

  async findDependents(filePath: string): Promise<FileIndexEntry[]> {
    const index = getIndexer().getIndex();
    if (!index) return [];
    const dependents: FileIndexEntry[] = [];
    for (const [, file] of index.files) {
      if (file.imports.some(imp => imp === filePath || imp.endsWith(filePath))) {
        dependents.push(file);
      }
    }
    return dependents;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private normalizeKeywords(task: string, extra: string[]): string[] {
    const words = task.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/);
    const combined = new Set<string>();
    for (const w of words) {
      if (w.length > 2 && !STOP_WORDS.has(w)) combined.add(w);
    }
    for (const k of extra) {
      const kl = k.toLowerCase();
      if (!STOP_WORDS.has(kl)) combined.add(kl);
    }
    return [...combined];
  }

  private rankFiles(
    files: Map<string, FileIndexEntry>,
    keywords: string[],
    taskType: string
  ): RankedFile[] {
    const scored: RankedFile[] = [];
    const isDocTask = taskType === 'documentation';
    const isBugOrFeature = taskType === 'bug' || taskType === 'feature';

    for (const [filePath, file] of files) {
      // Skip irrelevant types early
      if (!isDocTask && file.type !== 'source' && file.type !== 'test') continue;

      let score = 0;
      const reasons: string[] = [];
      const lowerPath = filePath.toLowerCase();
      const lowerName = file.name.toLowerCase();

      // Pre-lowercase exports once
      const lowerExports = file.exports.map(e => e.toLowerCase());

      for (const kw of keywords) {
        if (lowerPath.includes(kw) || lowerName.includes(kw)) {
          score += 10;
          reasons.push(`path:${kw}`);
        }
        for (const exp of lowerExports) {
          if (exp.includes(kw)) { score += 15; reasons.push(`export:${kw}`); break; }
        }
      }

      if (isBugOrFeature && file.type === 'source') { score += 5;  reasons.push('source'); }
      if (taskType === 'bug' && file.type === 'test') { score += 8;  reasons.push('test'); }
      if (isDocTask && file.type === 'doc')           { score += 20; reasons.push('doc'); }

      if (score > 0) scored.push({ file, score, reason: reasons.join(',') });
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  private findRelevantSymbols(
    symbols: Map<string, SymbolIndexEntry[]>,
    keywords: string[],
    topFilePathSet: Set<string>
  ): SymbolIndexEntry[] {
    const relevant: SymbolIndexEntry[] = [];

    for (const [, fileSymbols] of symbols) {
      for (const sym of fileSymbols) {
        if (!topFilePathSet.has(sym.file)) continue;
        const lname = sym.name.toLowerCase();
        for (const kw of keywords) {
          if (lname.includes(kw)) { relevant.push(sym); break; }
        }
        if (relevant.length >= 20) return relevant;
      }
    }
    return relevant;
  }

  private findRelevantTests(
    tests: TestIndexEntry[],
    topFiles: FileIndexEntry[],
    topModules: Set<string>
  ): TestIndexEntry[] {
    const topFilePaths = new Set(topFiles.map(f => f.path));
    const relevant: TestIndexEntry[] = [];
    const seen = new Set<string>();

    for (const test of tests) {
      if (seen.has(test.path)) continue;
      const inScope =
        (test.targetFile && topFilePaths.has(test.targetFile)) ||
        topModules.has(test.path.split('/')[0] ?? '');
      if (inScope) { relevant.push(test); seen.add(test.path); }
      if (relevant.length >= 10) break;
    }
    return relevant;
  }

  private findRelevantDocs(
    docs: DocIndexEntry[],
    keywords: string[],
    topModules: Set<string>
  ): DocIndexEntry[] {
    const relevant: DocIndexEntry[] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
      if (seen.has(doc.path)) continue;
      const lname = doc.name.toLowerCase();
      const lpath = doc.path.toLowerCase();
      const keyMatch   = keywords.some(kw => lname.includes(kw) || lpath.includes(kw));
      const modMatch   = topModules.has(doc.path.split('/')[0] ?? '');
      if (keyMatch || modMatch) { relevant.push(doc); seen.add(doc.path); }
      if (relevant.length >= 5) break;
    }
    return relevant;
  }

  private calculateConfidence(rankedFiles: RankedFile[], keywords: string[]): number {
    if (rankedFiles.length === 0 || keywords.length === 0) return 0;
    const avgScore     = rankedFiles.reduce((s, r) => s + r.score, 0) / rankedFiles.length;
    const maxPossible  = keywords.length * 25;
    return Math.round(Math.min(avgScore / maxPossible, 1) * 100) / 100;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let retrievalInstance: RetrievalEngine | null = null;

export function getRetrievalEngine(): RetrievalEngine {
  if (!retrievalInstance) retrievalInstance = new RetrievalEngine();
  return retrievalInstance;
}

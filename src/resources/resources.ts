// MCP Resources - Compact repo intelligence accessible via repo:// URIs
import { RepositoryIndex } from '../core/types.js';
import { getIndexer } from '../core/indexer/indexer.js';

// ─── Resource URI constants ──────────────────────────────────────────────────

export const RESOURCE_URIS = {
  ARCHITECTURE_MAP: 'repo://architecture-map',
  MODULE_INDEX:     'repo://module-index',
  SYMBOL_INDEX:     'repo://symbol-index',
  TEST_MAP:         'repo://test-map',
  DOC_MAP:          'repo://doc-map',
  PATTERNS:         'repo://patterns',
  GLOSSARY:         'repo://glossary'
} as const;

export type ResourceUri = typeof RESOURCE_URIS[keyof typeof RESOURCE_URIS];

export const RESOURCE_LIST = [
  { uri: RESOURCE_URIS.ARCHITECTURE_MAP, name: 'Architecture Map',    description: 'Compact high-level module structure and dependency graph', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.MODULE_INDEX,     name: 'Module Index',        description: 'All top-level modules with file counts and export summaries', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.SYMBOL_INDEX,     name: 'Symbol Index',        description: 'Compact index of exported functions, classes, interfaces, and types', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.TEST_MAP,         name: 'Test Map',            description: 'Map of test files with their types and target source files', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.DOC_MAP,          name: 'Documentation Map',   description: 'Map of documentation files with section summaries', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.PATTERNS,         name: 'Code Patterns',       description: 'Common patterns detected in the repository', mimeType: 'application/json' },
  { uri: RESOURCE_URIS.GLOSSARY,         name: 'Project Glossary',    description: 'Key terms, symbol names, file names, and module names', mimeType: 'application/json' }
];

// ─── Cache ───────────────────────────────────────────────────────────────────
// Resources are rebuilt only when the index changes (keyed by lastIndexed timestamp)

interface CacheEntry { result: object; indexedAt: number }
const resourceCache = new Map<string, CacheEntry>();

function cached(uri: string, builder: (index: RepositoryIndex) => object): object {
  const index = getIndexer().getIndex();
  if (!index) return { error: 'No repository indexed. Call repo_scope_find with repoPath first.' };

  const hit = resourceCache.get(uri);
  if (hit && hit.indexedAt === index.lastIndexed) return hit.result;

  const result = builder(index);
  resourceCache.set(uri, { result, indexedAt: index.lastIndexed });
  return result;
}

// ─── Resource builders ───────────────────────────────────────────────────────

export function buildArchitectureMap(): object {
  return cached(RESOURCE_URIS.ARCHITECTURE_MAP, index => {
    const modules: Record<string, { files: number; sourceFiles: number; testFiles: number; exports: string[]; imports: string[] }> = {};

    for (const [filePath, file] of index.files) {
      const mod = filePath.split('/')[0] ?? 'root';
      if (!modules[mod]) modules[mod] = { files: 0, sourceFiles: 0, testFiles: 0, exports: [], imports: [] };
      modules[mod].files++;
      if (file.type === 'source') { modules[mod].sourceFiles++; modules[mod].exports.push(...file.exports.slice(0, 5)); }
      if (file.type === 'test')   modules[mod].testFiles++;
      // Only external imports (no relative paths)
      for (const imp of file.imports) {
        if (!imp.startsWith('.')) modules[mod].imports.push(imp.split('/')[0] ?? imp);
      }
    }

    // Deduplicate using Set — one pass
    for (const mod of Object.values(modules)) {
      mod.exports = [...new Set(mod.exports)].slice(0, 10);
      mod.imports = [...new Set(mod.imports)].slice(0, 10);
    }

    // Build edges with Set-based dedup (composite key)
    const edgeSet = new Set<string>();
    const edges: Array<{ from: string; to: string }> = [];
    for (const edge of index.imports) {
      const from = edge.from.split('/')[0] ?? 'root';
      const to   = edge.to.split('/')[0] ?? 'root';
      const key  = `${from}→${to}`;
      if (from !== to && !edgeSet.has(key)) { edgeSet.add(key); edges.push({ from, to }); }
    }

    return { rootPath: index.rootPath, lastIndexed: new Date(index.lastIndexed).toISOString(), totalFiles: index.files.size, modules, dependencyEdges: edges };
  });
}

export function buildModuleIndex(): object {
  return cached(RESOURCE_URIS.MODULE_INDEX, index => {
    const modules: Record<string, { path: string; fileCount: number; sourceFileCount: number; topExports: string[]; language: string }> = {};

    for (const [filePath, file] of index.files) {
      const mod = filePath.split('/').length > 1 ? filePath.split('/')[0] : 'root';
      if (!modules[mod]) modules[mod] = { path: mod, fileCount: 0, sourceFileCount: 0, topExports: [], language: file.language };
      modules[mod].fileCount++;
      if (file.type === 'source') { modules[mod].sourceFileCount++; modules[mod].topExports.push(...file.exports.slice(0, 3)); }
    }
    for (const mod of Object.values(modules)) mod.topExports = [...new Set(mod.topExports)].slice(0, 10);

    return { modules };
  });
}

export function buildSymbolIndex(): object {
  return cached(RESOURCE_URIS.SYMBOL_INDEX, index => {
    const exported: Array<{ name: string; type: string; file: string; line: number }> = [];
    for (const [, symbols] of index.symbols) {
      for (const sym of symbols) {
        if (sym.exported) exported.push({ name: sym.name, type: sym.type, file: sym.file, line: sym.line });
      }
    }
    return { totalSymbols: exported.length, symbols: exported.slice(0, 200) };
  });
}

export function buildTestMap(): object {
  return cached(RESOURCE_URIS.TEST_MAP, index => ({
    totalTests: index.tests.length,
    tests: index.tests.map(t => ({ path: t.path, type: t.type, targetFile: t.targetFile ?? null }))
  }));
}

export function buildDocMap(): object {
  return cached(RESOURCE_URIS.DOC_MAP, index => ({
    totalDocs: index.docs.length,
    docs: index.docs.map(d => ({ path: d.path, type: d.type, sections: d.sections.slice(0, 5) }))
  }));
}

export function buildPatterns(): object {
  return cached(RESOURCE_URIS.PATTERNS, index => {
    const singletons: string[] = [], factories: string[] = [], handlers: string[] = [], schemas: string[] = [];
    for (const [filePath, symbols] of index.symbols) {
      for (const sym of symbols) {
        const n = sym.name.toLowerCase();
        if (n.startsWith('get') && sym.type === 'function')        singletons.push(`${sym.name} (${filePath})`);
        if (n.includes('factory') || n.includes('create'))        factories.push(`${sym.name} (${filePath})`);
        if (n.includes('handler') || n.includes('middleware'))    handlers.push(`${sym.name} (${filePath})`);
        if (n.includes('schema') || n.includes('validator'))      schemas.push(`${sym.name} (${filePath})`);
      }
    }
    return {
      singletonGetters: singletons.slice(0, 20),
      factories:        factories.slice(0, 20),
      handlers:         handlers.slice(0, 20),
      schemas:          schemas.slice(0, 20)
    };
  });
}

export function buildGlossary(): object {
  return cached(RESOURCE_URIS.GLOSSARY, index => {
    const modules = new Set<string>();
    const fileNames = new Set<string>();
    const exportedSymbols = new Set<string>();
    for (const [filePath, file] of index.files) {
      const mod = filePath.split('/')[0];
      if (mod) modules.add(mod);
      fileNames.add(file.name);
      for (const e of file.exports) exportedSymbols.add(e);
    }
    return {
      modules:         [...modules].sort(),
      fileNames:       [...fileNames].sort().slice(0, 100),
      exportedSymbols: [...exportedSymbols].sort().slice(0, 200)
    };
  });
}

// ─── Resource router ─────────────────────────────────────────────────────────

const BUILDERS: Record<string, () => object> = {
  [RESOURCE_URIS.ARCHITECTURE_MAP]: buildArchitectureMap,
  [RESOURCE_URIS.MODULE_INDEX]:     buildModuleIndex,
  [RESOURCE_URIS.SYMBOL_INDEX]:     buildSymbolIndex,
  [RESOURCE_URIS.TEST_MAP]:         buildTestMap,
  [RESOURCE_URIS.DOC_MAP]:          buildDocMap,
  [RESOURCE_URIS.PATTERNS]:         buildPatterns,
  [RESOURCE_URIS.GLOSSARY]:         buildGlossary
};

export function readResource(uri: string): { content: string; mimeType: string } | null {
  const builder = BUILDERS[uri];
  if (!builder) return null;
  return { content: JSON.stringify(builder(), null, 2), mimeType: 'application/json' };
}

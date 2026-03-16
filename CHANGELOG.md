# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-16

### Documentation
- Full benchmark results published: 15 scenarios across 2 real projects (engi-mcp repo + fresh sandbox), 51 files total
- Combined result: 225,983 → 8,716 tokens · **96.1% reduction**
- Added real API cost savings table (Claude Sonnet pricing · up to $418/month saved per developer at 50 tasks/day)
- Updated top-level banner and token-savings badge to reflect v1.2.0 numbers

## [1.2.0] - 2026-03-16

### Added
- **RAG Engine** (`src/core/rag/rag.ts`) — chunks file content into function/class bodies, scores via TF-IDF term overlap, cached by `lastIndexed`
- **`RagEngine.retrieve()`** — semantic keyword retrieval across all indexed chunks
- **`RagEngine.retrieveByLiteral()`** — literal string search (error codes, symbol names) for bug tracing
- **`FlowStep.snippet`** — RAG-retrieved code snippet attached to each flow step (standard/detailed verbosity)
- **`BugCause.snippet`** — actual code near the suspected bug location, attached by RAG
- **Summarizer: RAG-augmented flow summaries** — each step now carries a real code snippet from the file, not just file name + export list
- **Summarizer: RAG-augmented bug traces** — literal + semantic retrieval finds the exact function containing the bug; cause includes file, symbol, and snippet
- **Summarizer: RAG-augmented doc context** — code examples pulled from actual file content via semantic search, replacing fragile regex extraction

### Changed
- `SummarizationEngine.generateFlowSummary` now uses RAG to attach code snippets to steps
- `SummarizationEngine.traceBug` runs both literal + semantic RAG retrieval; merges results, enriches causes
- `SummarizationEngine.buildDocContext` uses RAG for example extraction instead of manual regex
- Audience notes expanded: `api`, `pm`, `qa` cases added to `generateAudienceNote`
- `FlowStep` and `BugCause` interfaces extended with optional `snippet` field

## [1.1.1] - 2026-03-16

### Fixed
- **Indexer**: `extractExportsImports` used `match[2]` for `TS_IMPORT` regex which only has one capture group — imports were always `undefined`, crashing `impact_analyze` and `buildArchitectureMap`
- **Indexer**: Python import extraction now guards against undefined match groups

## [1.1.0] - 2026-03-16

### Performance Improvements
- **Indexer**: Parallel file I/O with `Promise.all` — all files read concurrently instead of sequentially
- **Indexer**: Each file read once (was read 2–3 times: stat + exports + symbols)
- **Indexer**: Async directory scanning with parallel subtree recursion
- **Indexer**: Deduplicates concurrent `indexRepository` calls (one in-flight index at a time)
- **Indexer**: Pre-compiled regex patterns as module-level constants (not recompiled per file)
- **Indexer**: `SET`-based pattern matching for `TEST_PATTERNS`, `DOC_PATTERNS`, `CONFIG_EXTS`, `SOURCE_EXTS`
- **Retriever**: Stop words moved to module-level `Set` — created once, `O(1)` lookup (was array created per call)
- **Retriever**: Exports lowercased once per file in `rankFiles` (not once per keyword)
- **Retriever**: `topFilePathSet` and `topModules` built as `Set` — all downstream lookups `O(1)`
- **Retriever**: `findRelevantTests` uses `Set` for deduplication and early exit at limit
- **Retriever**: `findRelevantDocs` uses `Set`-based dedup and early exit
- **Resources**: All 7 resource builders now cache results keyed by `index.lastIndexed` — rebuilt only when index changes
- **Resources**: Edge deduplication uses `Set` with composite key (was linear `.some()` scan)
- **Memory**: `getLatestForTask` is now `O(1)` via a `taskId → checkpointIds[]` index (was full scan)
- **Memory**: `taskIndex` rebuilt correctly on `load()` from persisted storage

### Changed
- Package renamed to `@simpletoolsindiaorg/engi-mcp`
- GitHub repository: [simpletoolsindia/Software-Engineering-Intelligence-MCP-Server](https://github.com/simpletoolsindia/Software-Engineering-Intelligence-MCP-Server)

## [1.0.0] - 2026-03-16

### Added
- 12 MCP tools across 5 capability modules (analysis, planning, execution, documentation, memory)
- 7 MCP resources via `repo://` URIs (architecture-map, module-index, symbol-index, test-map, doc-map, patterns, glossary)
- Repository indexer supporting 16 programming languages
- Keyword-based file scoring and retrieval engine (confidence 0–1)
- Three-level verbosity system: minimal / standard / detailed
- In-memory and file-based task memory checkpoint system
- 55 tests across all capability modules and utilities
- Token reduction benchmark: 97.3% average savings over direct file reading
- CLI entry point (`engineering-mcp`) for global install and npx usage
- Full TypeScript source with strict mode, declaration maps, and source maps

### Tools
- `task_classify` — detect task type and suggest next tools
- `repo_scope_find` — find minimum relevant files for a task (indexes repo on first call)
- `flow_summarize` — compact execution flow summary
- `bug_trace_compact` — symptom-based bug cause analysis
- `implementation_plan` — step-by-step feature/fix plan with edit targets
- `poc_plan` — minimum viable POC scaffolding
- `impact_analyze` — blast radius estimation before edits
- `test_select` — minimum test set for changed files
- `doc_context_build` — audience-targeted documentation context
- `doc_update_plan` — identify which docs need updating
- `memory_checkpoint` — save multi-session task state
- `memory_restore` — restore previously saved task state

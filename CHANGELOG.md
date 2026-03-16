# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

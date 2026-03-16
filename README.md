<div align="center">

```
███████╗███╗   ██╗ ██████╗ ██╗    ███╗   ███╗ ██████╗██████╗
██╔════╝████╗  ██║██╔════╝ ██║    ████╗ ████║██╔════╝██╔══██╗
█████╗  ██╔██╗ ██║██║  ███╗██║    ██╔████╔██║██║     ██████╔╝
██╔══╝  ██║╚██╗██║██║   ██║██║    ██║╚██╔╝██║██║     ██╔═══╝
███████╗██║ ╚████║╚██████╔╝██║    ██║ ╚═╝ ██║╚██████╗██║
╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝    ╚═╝     ╚═╝ ╚═════╝╚═╝
```

**Software Engineering Intelligence — MCP Server**

*Stop feeding Claude your entire codebase. Give it a brain instead.*

[![npm version](https://img.shields.io/npm/v/@simpletoolsindiaorg/engi-mcp?style=flat-square&color=cb3837&label=npm)](https://www.npmjs.com/package/@simpletoolsindiaorg/engi-mcp)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blueviolet?style=flat-square)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-55%20passing-success?style=flat-square)](src/)
[![Token Savings](https://img.shields.io/badge/token%20savings-96%25-ff6b35?style=flat-square)](#-proven-token-savings)

</div>

---

## Why?

Every time Claude Code helps you with a task, it reads files. Lots of them. For a 50,000-line repo, that is **hundreds of thousands of tokens per session** — slow, expensive, and wasteful.

**engi-mcp** gives Claude a compact intelligence layer: indexed summaries, scoped file discovery, and compact planning tools. Instead of reading 27 files (18,000 tokens), Claude reads a 350-token summary and gets the same job done.

```
WITHOUT engi-mcp:  Claude reads 30 files  →  20,842 tokens
WITH    engi-mcp:  3 tool calls            →     528 tokens
                                    ─────────────────────────
                   SAVED: 20,314 tokens  (97.5% reduction)

Combined across 15 real scenarios · 51 files · 2 projects:
  225,983 tokens  →  8,716 tokens  →  96.1% reduction
```

---

## Table of Contents

- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [All 12 Tools](#-all-12-tools)
- [All 7 Resources](#-all-7-resources)
- [Proven Token Savings](#-proven-token-savings)
- [Recommended Workflow](#-recommended-workflow)
- [Integration with Claude Code](#-integration-with-claude-code)
- [Architecture Deep Dive](#-architecture-deep-dive)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)
- [Development](#-development)

---

## Quick Start

```bash
# Install globally
npm install -g @simpletoolsindiaorg/engi-mcp

# Or use directly with npx (no install needed)
npx @simpletoolsindiaorg/engi-mcp
```

Add to your Claude Code config (~/.claude.json):

```json
{
  "mcpServers": {
    "engi": {
      "command": "npx",
      "args": ["-y", "@simpletoolsindiaorg/engi-mcp"],
      "env": { "LOG_LEVEL": "warn" }
    }
  }
}
```

That is it. Claude now has a 97%-more-efficient brain for your repo.

---

## How It Works

```
Your Repo                    engi-mcp                      Claude
    │                            │                             │
    │  ← index on first call ────┤                             │
    │                            │  task_classify(task) ───────┤
    │                     detects type, suggests tools         │
    │                            │  repo_scope_find(task) ─────┤
    │                     ranks and returns top 5 files        │
    │                            │  flow_summarize(files) ─────┤
    │                     compact summary, not raw code        │
    │                            │  implementation_plan() ─────┤
    │                     step-by-step with edit targets       │
    │                            │  impact_analyze() ──────────┤
    │                     blast radius before any edit         │
    │                            │                             │
    │                            │ ← edit the right files only ┤
```

### Core Pipeline

| Stage | What Happens |
|-------|-------------|
| **Index** | Scan repo once → build lightweight file/symbol/import/test/doc index |
| **Retrieve** | Score and rank files by keyword match, export match, file type preference |
| **Summarize** | Generate compact flow descriptions, not raw source code |
| **Plan** | Return edit targets, risk notes, required tests — no reading needed |
| **Memory** | Checkpoint task state so multi-session work never restarts from scratch |

---

## All 12 Tools

### Analysis Tools

#### task_classify
Identifies what kind of task you are working on before doing any file reading.

```json
{ "task": "Fix the null pointer when user logs out" }
```
```json
{
  "types": ["bug"],
  "confidence": 0.8,
  "suggestedMode": "planning",
  "nextTools": ["repo_scope_find", "implementation_plan"]
}
```

---

#### repo_scope_find
Finds the minimum relevant files for your task. Pass repoPath the first time to build the index.

```json
{
  "task": "Fix the null pointer when user logs out",
  "taskType": "bug",
  "repoPath": "/abs/path/to/your/repo",
  "limit": 10
}
```
```json
{
  "files": [
    { "path": "src/auth/logout.ts", "exports": ["logout", "clearSession"] },
    { "path": "src/auth/session.ts", "exports": ["SessionManager"] }
  ],
  "modules": ["auth"],
  "symbols": ["logout", "clearSession"],
  "confidence": 0.87
}
```

Note: Only pass repoPath once per session. The index persists in memory.

---

#### flow_summarize
Returns a compact execution flow — no raw source code.

```json
{
  "scope": ["src/auth/logout.ts", "src/auth/session.ts"],
  "verbosity": "standard"
}
```
```json
{
  "summary": "2 files in flow",
  "steps": [
    { "order": 1, "description": "logout.ts calls clearSession() and emits event" },
    { "order": 2, "description": "session.ts SessionManager.destroy() removes token" }
  ],
  "keySymbols": ["logout", "clearSession", "SessionManager"],
  "entryPoint": "src/auth/logout.ts"
}
```

---

#### bug_trace_compact
Analyzes a symptom description to pinpoint likely causes without reading files.

```json
{
  "symptom": "null pointer exception when calling session.user.id after logout",
  "scope": ["src/auth/logout.ts", "src/auth/session.ts"]
}
```
```json
{
  "likelyCauses": [
    { "type": "null_undefined", "description": "session.user not cleared before event fires", "likelihood": 0.85 },
    { "type": "race_condition", "description": "async clearSession called without await", "likelihood": 0.6 }
  ],
  "suspectFiles": ["src/auth/session.ts"],
  "confidence": 0.72
}
```

---

### Planning Tools

#### implementation_plan
Generates a complete step-by-step plan with exact edit targets and risk notes.

```json
{
  "task": "Add rate limiting to the auth endpoint",
  "taskType": "feature",
  "scope": ["src/auth/router.ts", "src/middleware/index.ts"]
}
```
```json
{
  "steps": [
    { "order": 1, "description": "Add rate-limit middleware", "file": "src/middleware/rateLimit.ts", "action": "create" },
    { "order": 2, "description": "Register middleware in router", "file": "src/auth/router.ts", "action": "modify" }
  ],
  "editTargets": [{ "file": "src/auth/router.ts", "description": "Add rateLimit middleware before /login handler" }],
  "requiredTests": ["src/auth/router.test.ts"],
  "riskNotes": ["Verify rate limit headers do not break existing auth tests"]
}
```

---

#### poc_plan
Scaffolds a minimum viable proof-of-concept — skips production concerns deliberately.

```json
{
  "goal": "Streaming token counter API endpoint",
  "constraints": ["no auth", "simple"]
}
```
```json
{
  "minimalArchitecture": "Simple Express HTTP handler with minimal routing",
  "filesToCreate": ["src/poc/handler.ts"],
  "shortcutsAllowed": ["Use in-memory storage", "Skip authentication"],
  "excludedScope": ["Database integration", "Complex validation"],
  "mockStrategy": "Use hardcoded test data and in-memory implementations"
}
```

---

### Execution Tools

#### impact_analyze
Estimates blast radius before you make any edit.

```json
{
  "scope": ["src/core/indexer/indexer.ts"],
  "changeType": "modify"
}
```
```json
{
  "affectedFiles": ["src/core/retrieval/retriever.ts", "src/resources/resources.ts"],
  "affectedModules": ["core", "resources"],
  "regressionNotes": ["retriever depends on FileIndexEntry shape"],
  "riskyPoints": ["RepositoryIndex interface change would cascade to all 5 consumers"],
  "relatedTests": ["src/capabilities/analysis/analysis.test.ts"]
}
```

---

#### test_select
Returns the minimum test set — stop running npm test when you only changed 2 files.

```json
{
  "scope": ["src/utils/token-counter.ts"],
  "changeType": "modify"
}
```
```json
{
  "requiredTests": [{ "path": "src/utils/utils.test.ts", "type": "unit" }],
  "optionalTests": [],
  "reason": "Found 1 required and 0 optional tests for changed files"
}
```

---

### Documentation Tools

#### doc_context_build
Builds compact context for writing documentation, targeted at a specific audience.

```json
{
  "feature": "New impact_analyze tool added to execution module",
  "changedFiles": ["src/capabilities/execution/execution.ts"],
  "audience": "api"
}
```

#### doc_update_plan
Identifies exactly which docs need updating after code changes.

```json
{
  "changedFiles": ["src/capabilities/execution/execution.ts", "src/core/types.ts"]
}
```
```json
{
  "docsToUpdate": [{ "path": "README.md", "reason": "References changed module: capabilities" }],
  "sectionsToUpdate": ["README.md - capabilities section"],
  "examplesNeeded": ["Example usage of execution"]
}
```

---

### Memory Tools

#### memory_checkpoint
Saves task state at the end of a session so the next session resumes — not restarts.

```json
{
  "taskId": "auth-refactor-2024",
  "taskType": "feature",
  "files": ["src/auth/router.ts", "src/middleware/rateLimit.ts"],
  "decisions": [{ "description": "Use token bucket algorithm", "rationale": "Simpler than sliding window for our load" }],
  "risks": ["rate limit headers must match nginx proxy config"],
  "notes": "Step 2/4 done. Next: add Redis backend."
}
```

#### memory_restore
Restores a previously saved checkpoint by taskId.

```json
{ "taskId": "auth-refactor-2024" }
```
```json
{
  "progressSummary": "1 decision recorded. 1 risk noted.",
  "unresolvedItems": ["rate limit headers must match nginx proxy config"]
}
```

---

## All 7 Resources

Resources are read via repo:// URIs — lighter than tools, no arguments needed.

| Resource URI | What It Returns | Typical Use |
|---|---|---|
| repo://architecture-map | Module dependency graph with edge counts | Before a large refactor |
| repo://module-index | All modules: file counts, languages, top exports | Understanding repo shape |
| repo://symbol-index | All exported symbols (capped 200) with file + line | Finding where something lives |
| repo://test-map | Test files to source targets mapping | Knowing test coverage at a glance |
| repo://doc-map | Docs with sections | Finding which doc to update |
| repo://patterns | Detected singletons, factories, handlers, schemas | Matching existing patterns |
| repo://glossary | All module/file/symbol names | Disambiguation before searching |

---

## Proven Token Savings

Full benchmark run across **two real projects** — 15 scenarios, 51 files, every tool and resource exercised.

### Test 1 — engi-mcp own repo (30 files · 20,842 token baseline)

| Scenario | Tools | Without MCP | With MCP | Saved |
|----------|-------|------------|---------|-------|
| Analysis | 3 | 20,842 | 528 | **97.5%** |
| Bug Fix | 3 | 20,842 | 950 | **95.4%** |
| Feature | 5 | 20,842 | 1,159 | **94.4%** |
| POC | 2 | 20,842 | 128 | **99.4%** |
| Documentation | 3 | 20,842 | 443 | **97.9%** |
| Multi-session Memory | 2 | 41,684 | 422 | **99.0%** |
| All 7 Resources | 7 | 20,842 | 870 | **95.8%** |
| **TOTAL** | **19/19** | **166,736** | **4,500** | **97.3%** |

### Test 2 — Sandbox: fresh Node.js REST API (21 files · 6,583 token baseline)

> Project the MCP had never seen before — auth, users, db, notifications, utils.

| Scenario | Tools | Without MCP | With MCP | Saved |
|----------|-------|------------|---------|-------|
| Architecture Analysis | 3 | 6,583 | 194 | **97.1%** |
| Bug Fix | 3 | 6,583 | 866 | **86.8%** |
| Feature (OAuth2 login) | 5 | 6,583 | 854 | **87.0%** |
| Refactor (BaseRepo) | 4 | 6,583 | 813 | **87.7%** |
| POC (Redis rate limit) | 2 | 6,583 | 127 | **98.1%** |
| Documentation | 3 | 6,583 | 450 | **93.2%** |
| Multi-session Memory | 2 | 13,166 | 436 | **96.7%** |
| All 7 Resources | 7 | 6,583 | 476 | **92.8%** |
| **TOTAL** | **19/19** | **59,247** | **4,216** | **92.9%** |

### Combined across both tests

| | Tokens |
|--|--------|
| Without MCP | 225,983 |
| With MCP | 8,716 |
| **Saved** | **217,267** |
| **Net reduction** | **96.1%** |

Total wall time: **103ms** for 15 scenarios. Tool coverage: **19/19 (100%)**.

### Real Cost Savings (Claude API pricing)

> Prices based on Claude Sonnet 4.5 input token rate ($3 / 1M tokens).

| Usage | Without MCP | With MCP | Saved / session |
|-------|------------|---------|----------------|
| 10 tasks/day · small repo (6k tok) | ~$0.18 | ~$0.013 | **$0.17** |
| 10 tasks/day · medium repo (21k tok) | ~$0.63 | ~$0.045 | **$0.58** |
| 10 tasks/day · large repo (100k tok) | ~$3.00 | ~$0.21 | **$2.79** |
| 50 tasks/day · large repo | ~$15.00 | ~$1.05 | **$13.95/day** |

At 50 tasks/day on a large repo: **~$418/month saved per developer.**
The larger the repo, the greater the savings — token cost scales linearly with repo size, MCP cost does not.

### What RAG adds (v1.2.0+)

engi-mcp v1.2.0 added a RAG engine that chunks file content and attaches real code snippets to summaries. The snippets eliminate follow-up file reads that the benchmark does not count:

| Tool | Extra tokens (RAG) | What it replaces |
|------|--------------------|-----------------|
| `flow_summarize` | +12 | 1–2 Read calls (~800 tok) |
| `bug_trace_compact` | +270 | 2–4 Read calls (~2,000 tok) |
| `doc_context_build` | +212 | 2–3 Read calls (~1,500 tok) |

Run the benchmarks yourself:
```bash
# Clone and run against this repo
npx tsx test-token-report.ts

# Or against your own project — edit REPO_PATH in test-token-report.ts
```

---

## Recommended Workflow

Add this to your project CLAUDE.md:

```
Step 1:  task_classify(task)                 → detect type, get next tools
Step 2:  repo_scope_find(task, repoPath)     → find minimum relevant files
Step 3a: flow_summarize(files)               → analysis / feature
Step 3b: bug_trace_compact(symptom, files)   → bug fix
Step 3c: doc_context_build(feature, files)   → documentation
Step 4a: implementation_plan(task, files)    → feature or bug
Step 4b: poc_plan(goal)                      → proof of concept
Step 4c: doc_update_plan(changedFiles)       → documentation
Step 5:  impact_analyze(files, changeType)   → blast radius check
Step 6:  test_select(files)                  → minimum test set
Step 7:  memory_checkpoint(taskId, ...)      → save for next session
```

---

## Integration with Claude Code

### Option A — Global install

```bash
npm install -g @simpletoolsindiaorg/engi-mcp
```

Add to ~/.claude.json:

```json
{
  "mcpServers": {
    "engi": {
      "command": "engineering-mcp",
      "env": { "LOG_LEVEL": "warn" }
    }
  }
}
```

### Option B — npx (zero install)

```json
{
  "mcpServers": {
    "engi": {
      "command": "npx",
      "args": ["-y", "@simpletoolsindiaorg/engi-mcp"],
      "env": { "LOG_LEVEL": "warn" }
    }
  }
}
```

### Option C — Local path

```json
{
  "mcpServers": {
    "engi": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-token/dist/index.js"],
      "env": { "LOG_LEVEL": "warn" }
    }
  }
}
```

### Claude Desktop

Config path: ~/Library/Application Support/Claude/claude_desktop_config.json

```json
{
  "mcpServers": {
    "engi": {
      "command": "npx",
      "args": ["-y", "@simpletoolsindiaorg/engi-mcp"]
    }
  }
}
```

---

## Architecture Deep Dive

```
MCP Protocol (stdio)
    ListTools / CallTool / ReadResource
           │
    Server (src/index.ts)
    Tool Registry  ·  Request Routing
      │         │         │         │         │
  Analysis  Planning Execution   Docs    Memory
  4 tools   2 tools  2 tools   2 tools  2 tools
           │
    Core Layers
    Indexer → Retrieval Engine → Summarizer
           │
    Resources (repo:// URIs, 7 total)
```

### Indexer — What Gets Indexed

| What | How |
|------|-----|
| Files | Recursive scan, skips node_modules, dist, .git, build |
| File type | source / test / config / doc / other |
| Language | 16 languages detected by extension |
| Exports | Language-aware regex (TypeScript, JavaScript, Python, Go) |
| Imports | import from, require(), from ... import |
| Symbols | Functions, classes, interfaces, types with line numbers |
| Tests | Files matching *.test.*, *.spec.*, __tests__/ |
| Docs | Files matching readme, changelog, guide, api |

### Retrieval — Scoring Algorithm

```
For each file in index:
  score += 10  if keyword in file path or name
  score += 15  if keyword in file exports
  score += 8   if file type matches task type
  score += 20  if doc file for documentation task

confidence = avg(topN scores) / max_possible_score  →  0.0 to 1.0
```

### Verbosity Levels

| Level | Tokens | Use When |
|-------|--------|---------|
| minimal | ~50 | Default — just key facts |
| standard | ~150 | Exploring unfamiliar code |
| detailed | ~400 | Debugging complex flows |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| LOG_LEVEL | info | debug / info / warn / error |

---

## Project Structure

```
src/
├── index.ts                     MCP server · tool registry · request routing
├── bin.ts                       CLI entry (npx / global install)
├── core/
│   ├── types.ts                 All shared TypeScript interfaces
│   ├── indexer/indexer.ts       Repo scanner · export parser · singleton
│   ├── retrieval/retriever.ts   Keyword scorer · scope finder
│   └── summarizer/summarizer.ts Flow builder · bug tracer · doc builder
├── capabilities/
│   ├── analysis/                task_classify · repo_scope_find · flow_summarize · bug_trace_compact
│   ├── planning/                implementation_plan · poc_plan
│   ├── execution/               impact_analyze · test_select
│   ├── documentation/           doc_context_build · doc_update_plan
│   └── memory/                  memory_checkpoint · memory_restore
├── resources/resources.ts       7 repo:// resource builders
├── memory/memory.ts             Checkpoint store (in-memory + file)
└── utils/
    ├── token-counter.ts         estimateTokens · checkTokenBudget
    ├── logger.ts                stderr logger
    └── formatter.ts             Response formatting
```

---

## Development

```bash
npm install                      # install deps
npm run build                    # compile TypeScript
npm run dev                      # watch mode
npm test                         # run 55 tests
npx tsx test-token-report.ts     # token reduction benchmark
```

---

## License

MIT — see LICENSE

---

Made for engineers who want Claude to work smarter, not harder.

---

**Organization:** [simpletoolsindia](https://github.com/simpletoolsindia) · **npm:** [@simpletoolsindiaorg/engi-mcp](https://www.npmjs.com/package/@simpletoolsindiaorg/engi-mcp) · **GitHub:** [Software-Engineering-Intelligence-MCP-Server](https://github.com/simpletoolsindia/Software-Engineering-Intelligence-MCP-Server)

# Software Engineering Intelligence MCP Server — Agent Skills

This file defines how Claude Code should use the `@software-engineering/mcp-server`.

---

## Core Principle

> **Never read more code than needed for the current decision.**

Always use the MCP server's compact summaries before touching files directly.

---

## Mandatory Workflow

Follow this order for **every engineering task**:

### Step 1: Classify the task
```
task_classify(task: "<your task description>")
```
→ Returns: task type, suggested mode, next tools.

### Step 2: Find minimum relevant scope
```
repo_scope_find(task: "...", taskType: "...", repoPath: "/abs/path/to/repo")
```
→ Returns: top files, modules, symbols, related tests.  
→ Only call with `repoPath` the **first time** per session (it indexes the repo).

### Step 3: Get compact context
Choose ONE based on your task:
- **Analysis / Feature** → `flow_summarize(scope: [<top files>])`
- **Bug Fix** → `bug_trace_compact(symptom: "...", scope: [<top files>])`
- **Documentation** → `doc_context_build(feature: "...", changedFiles: [...])`

### Step 4: Plan
Choose ONE:
- **Feature or Bug** → `implementation_plan(task: "...", taskType: "...", scope: [...])`
- **POC** → `poc_plan(goal: "...")`
- **Docs** → `doc_update_plan(changedFiles: [...])`

### Step 5: Check blast radius
```
impact_analyze(scope: [<files you plan to change>], changeType: "modify")
```

### Step 6: Select tests
```
test_select(scope: [<files you changed>])
```

### Step 7: Checkpoint (for long tasks)
```
memory_checkpoint(taskId: "<unique-id>", taskType: "...", files: [...], decisions: [...])
```

---

## Resources (read before exploring files)

Before reading any file directly, check the relevant resource:

| What you need | Resource to read |
|---------------|-----------------|
| Module structure | `repo://architecture-map` |
| What modules exist | `repo://module-index` |
| Where a symbol is defined | `repo://symbol-index` |
| Which tests exist | `repo://test-map` |
| Which docs exist | `repo://doc-map` |
| Common patterns in codebase | `repo://patterns` |
| Key names and terms | `repo://glossary` |

---

## Verbosity Rules

- Always use `verbosity: "minimal"` (the default) unless you need more detail.
- Use `verbosity: "standard"` when minimal is insufficient.
- Only use `verbosity: "detailed"` for debugging.

---

## Long Task Memory

For tasks that span multiple steps or sessions:

```
# Start or resume a task
memory_restore(taskId: "<id>")   → restores scope, decisions, pending items

# Save progress
memory_checkpoint(...)           → saves scope, decisions, risks, pending work
```

---

## Anti-Patterns to Avoid

| ❌ Bad | ✅ Good |
|--------|---------|
| Read all files in a directory | `repo_scope_find` first |
| Grep the entire repo | `repo://symbol-index` or `repo_scope_find` |
| Read the full codebase to understand architecture | `repo://architecture-map` |
| Run all tests | `test_select` to get minimum set |
| Write docs without context | `doc_context_build` first |
| Start implementing without a plan | `implementation_plan` or `poc_plan` first |
| Ignore change impact | `impact_analyze` before every edit |

---

## Coverage by Task Type

### Analysis task
`task_classify` → `repo_scope_find` → `flow_summarize` → `memory_checkpoint`

### Feature implementation
`task_classify` → `repo_scope_find` → `flow_summarize` → `implementation_plan` → `impact_analyze` → `test_select` → `memory_checkpoint`

### Bug fix
`task_classify` → `repo_scope_find` → `bug_trace_compact` → `implementation_plan` → `impact_analyze` → `test_select` → `memory_checkpoint`

### POC
`task_classify` → `poc_plan` → `memory_checkpoint`

### Documentation
`task_classify` → `repo_scope_find` → `doc_context_build` → `doc_update_plan` → `memory_checkpoint`

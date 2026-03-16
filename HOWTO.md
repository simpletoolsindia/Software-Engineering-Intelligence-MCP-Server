# How to Add engi-mcp to Claude Code & Claude Desktop

Complete integration guide for @simpletoolsindiaorg/engi-mcp v1.1.0

---

## What is engi-mcp?

engi-mcp is a Software Engineering Intelligence MCP (Model Context Protocol) server.
It gives Claude a compact, indexed understanding of your repository — so instead of
reading dozens of source files (18,000+ tokens), Claude calls 2-3 tools (~400 tokens)
and gets the same job done. Average token savings: 97%.

---

## Option 1 — Claude Code (CLI)

### Step 1: Verify Claude Code is installed

  claude --version

If not installed: https://claude.ai/code

### Step 2: Open your Claude config file

  open ~/.claude.json

Or edit with any editor:

  nano ~/.claude.json
  code ~/.claude.json

### Step 3: Add engi-mcp to mcpServers

Find or create the "mcpServers" key and add the "engi" entry:

  {
    "mcpServers": {
      "engi": {
        "command": "npx",
        "args": ["-y", "@simpletoolsindiaorg/engi-mcp"],
        "env": {
          "LOG_LEVEL": "warn"
        }
      }
    }
  }

If you already have other MCP servers (like OpusCode), just add the "engi" block inside
"mcpServers" alongside them:

  {
    "mcpServers": {
      "OpusCode": { ... },
      "engi": {
        "command": "npx",
        "args": ["-y", "@simpletoolsindiaorg/engi-mcp"],
        "env": { "LOG_LEVEL": "warn" }
      }
    }
  }

### Step 4: Restart Claude Code

Close and reopen your terminal session, then start Claude Code:

  claude

### Step 5: Verify the tools are available

In Claude Code, ask:

  "What MCP tools do you have available?"

You should see all 12 engi tools listed:
  task_classify, repo_scope_find, flow_summarize, bug_trace_compact,
  implementation_plan, poc_plan, impact_analyze, test_select,
  doc_context_build, doc_update_plan, memory_checkpoint, memory_restore

### Step 6: Use it on your project

Tell Claude the repo path on first use:

  "Analyze this project. Use repo_scope_find with repoPath /path/to/your/project"

After the first call, the index is cached in memory — no repoPath needed again
in the same session.

---

## Option 2 — Claude Desktop (Mac/Windows)

### Step 1: Find the config file

Mac:
  ~/Library/Application Support/Claude/claude_desktop_config.json

Windows:
  %APPDATA%\Claude\claude_desktop_config.json

### Step 2: Open and edit

Mac:
  open ~/Library/Application\ Support/Claude/claude_desktop_config.json

Windows (PowerShell):
  notepad "$env:APPDATA\Claude\claude_desktop_config.json"

### Step 3: Add engi-mcp

If the file is empty or new:

  {
    "mcpServers": {
      "engi": {
        "command": "npx",
        "args": ["-y", "@simpletoolsindiaorg/engi-mcp"],
        "env": {
          "LOG_LEVEL": "warn"
        }
      }
    }
  }

If the file already has content, add "engi" inside the existing "mcpServers" object.

### Step 4: Restart Claude Desktop

Completely quit (Cmd+Q on Mac, close from taskbar on Windows) and reopen.

### Step 5: Verify

In a new conversation, ask:

  "List your available MCP tools"

You should see the 12 engi tools.

---

## Option 3 — Global Install (faster startup, no npx)

### Step 1: Install globally

  npm install -g @simpletoolsindiaorg/engi-mcp

### Step 2: Verify the binary

  which engineering-mcp
  engineering-mcp --help

### Step 3: Update config to use binary directly

In ~/.claude.json (Claude Code) or claude_desktop_config.json (Claude Desktop):

  {
    "mcpServers": {
      "engi": {
        "command": "engineering-mcp",
        "env": { "LOG_LEVEL": "warn" }
      }
    }
  }

Note: No "args" needed — the binary is the entry point.

---

## Option 4 — Local Development Build

If you cloned the repo and want to use your local build:

  cd /path/to/mcp-token
  npm install
  npm run build

Config:

  {
    "mcpServers": {
      "engi": {
        "command": "node",
        "args": ["/absolute/path/to/mcp-token/dist/index.js"],
        "env": { "LOG_LEVEL": "debug" }
      }
    }
  }

Use LOG_LEVEL "debug" to see all tool calls in stderr during development.

---

## Add CLAUDE.md to Your Project (Recommended)

Create a CLAUDE.md in your project root to tell Claude to always use engi-mcp:

  # Engineering Workflow

  ## Mandatory: Use engi-mcp for every task

  Before reading any file directly, follow this order:

  Step 1:  task_classify(task)
           → Detect task type (bug/feature/analysis/poc/docs)

  Step 2:  repo_scope_find(task, taskType, repoPath="/abs/path/to/this/repo")
           → Find minimum relevant files (pass repoPath only on first call per session)

  Step 3a: flow_summarize(scope)          → for analysis / feature tasks
  Step 3b: bug_trace_compact(symptom)     → for bug fix tasks
  Step 3c: doc_context_build(feature)     → for documentation tasks

  Step 4a: implementation_plan(task, scope)  → feature or bug
  Step 4b: poc_plan(goal)                    → proof of concept
  Step 4c: doc_update_plan(changedFiles)     → documentation

  Step 5:  impact_analyze(scope, changeType)  → check blast radius before editing
  Step 6:  test_select(scope)                 → run only relevant tests
  Step 7:  memory_checkpoint(taskId, ...)     → save progress for long tasks

  ## Anti-patterns (never do these)
  - Do NOT read all files in a directory
  - Do NOT grep the entire repo
  - Do NOT start coding without calling task_classify first
  - Do NOT run all tests — use test_select

---

## Verify Integration is Working

Run this quick test in Claude Code or Desktop:

  "Use task_classify to classify this task: fix a bug where the login fails"

Expected response:

  {
    "types": ["bug"],
    "confidence": 0.8,
    "suggestedMode": "planning",
    "nextTools": ["repo_scope_find", "implementation_plan"]
  }

If you see this JSON, the MCP server is connected and working.

---

## Environment Variables

  LOG_LEVEL    info (default) | debug | warn | error

  Set "warn" in production to suppress info logs.
  Set "debug" during development to see every tool call.

---

## Troubleshooting

Problem: Tools not showing up after restart
  Solution: Check JSON syntax in config file — one missing comma breaks it
  Check:    jsonlint ~/.claude.json

Problem: "No repository indexed" error
  Solution: Pass repoPath in the first repo_scope_find call:
            repo_scope_find(task: "...", taskType: "analysis", repoPath: "/abs/path/to/repo")

Problem: npx taking too long on first run
  Solution: Install globally: npm install -g @simpletoolsindiaorg/engi-mcp
            Then use "command": "engineering-mcp" in config

Problem: Permission denied on dist/bin.js
  Solution: chmod +x /path/to/mcp-token/dist/bin.js

---

## Links

npm:     https://www.npmjs.com/package/@simpletoolsindiaorg/engi-mcp
GitHub:  https://github.com/simpletoolsindia/Software-Engineering-Intelligence-MCP-Server
Issues:  https://github.com/simpletoolsindia/Software-Engineering-Intelligence-MCP-Server/issues

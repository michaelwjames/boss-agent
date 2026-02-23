# Boss Agent Skill Catalogue

This catalogue lists the available skills and tools integrated into the Boss Agent infrastructure. For detailed information on command arguments and targets, refer to the `SKILL.md` file in each skill's directory or the root `Makefile`.

## Core Skills

### 1. Jules Agent
- **Description:** A powerful AI-to-AI interface for complex coding tasks, repository refactoring, and PR management using the Google Jules API.
- **Location:** `skills/jules-agent/`
- **Main Tool:** `jules` (action, prompt, repo, sessionId)
- **Detailed Docs:** `skills/jules-agent/SKILL.md`
- **Make Targets:**
  - `make jules A="..."`: Direct access to the client.
  - `make jules-help`: Show client help.

### 2. Reminders
- **Description:** Set delayed reminders that trigger at a specific time.
- **Location:** `skills/remind.js`
- **Make Target:** `make remind DELAY= MESSAGE=`
- **Example:** `make remind DELAY=5m MESSAGE="Check deployment"`

## System & Helper Tools (via Makefile)

These tools are executed via the `run_make` tool.

### Git Management
- `git-status`: Show working tree status.
- `git-diff`: Show unstaged changes.
- `git-log`: Show last 20 commits.
- `git-summary`: Summarized git report.

### PR Management (GitHub CLI)
- `pr-list`: List open PRs.
- `pr-diff PR_NUMBER=N`: Show PR diff.
- `pr-view PR_NUMBER=N`: Show PR details.
- `pr-merge PR_NUMBER=N`: Merge a PR.
- `pr-close PR_NUMBER=N`: Close a PR.

### Integrations (External Services)
- `safe-gemini QUERY=`: Run a safe query via Gemini.
- `linear-task TITLE= DESCRIPTION=`: Create a task in Linear.
- `vercel-logs`: Fetch Vercel deployment logs.

### File Operations
- `list-files DIR=`: List files in a directory.
- `read-file FILE=`: Read a specific file.
- `read-skill S=`: Read a skill's `SKILL.md`.

## How to find more information
To see all available make targets and their expected arguments, you can ask the Boss Agent to run `make help`.
For more detailed information about a specific skill, use `make read-skill S=<skill-name>`.

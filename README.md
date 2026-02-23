# Boss Agent

A Discord-based AI agent powered by Groq's LLM and Whisper models, featuring voice support, session persistence, and a safety-first architecture that restricts execution to predefined Makefile targets.

## Overview

Boss Agent is a dual-modal Discord bot that handles both text and audio inputs. It uses Groq's fast inference for chat completions and Whisper for voice transcription. The agent maintains conversation history per Discord channel, loads context from local markdown files, and can only execute commands defined in a root-level Makefile for security.

## Architecture

### Core Components

```
boss-agent/
├── index.js              # Main Discord bot entry point
├── lib/
│   ├── groq_provider.js  # Groq SDK wrapper (LLM + Whisper)
│   ├── file_system.js    # File operations (vault, memory, sessions)
│   ├── tools.js          # Tool registry and executor
│   ├── make_executor.js  # Make target execution
│   ├── provider.js       # Base LLM provider interface
│   ├── shell_executor.js # Shell command execution
│   └── nomenclature.js   # Repository cataloging middleware
├── vault/                # Persistent knowledge base
├── memory/               # Agent-written notes
├── skills/               # Reusable skill scripts
├── session_history/      # Per-channel conversation history
└── soul.md               # Personality definition
```

### Message Flow

1. **Input Processing** (`index.js:42-77`)
   - Discord message received
   - Check for audio attachments → transcribe via Groq Whisper
   - Extract text content
   - Skip if no processable content

2. **Context Loading** (`index.js:83-86`)
   - Load personality from `soul.md`
   - Read all notes from `vault/`, `memory/`, `skills/`
   - Load session history for this Discord channel

3. **LLM Interaction** (`index.js:87-133`)
   - Build system prompt with personality + context
   - Send to Groq with tool definitions
   - Execute tool calls in a loop until complete
   - Return final response

4. **Response Delivery** (`index.js:135-149`)
   - Split messages >2000 chars (Discord limit)
   - Send reply to channel
   - Save updated session history

## Key Features

### Voice Support
- Audio attachments are downloaded to temp directory
- Transcribed using Groq's Whisper model (`whisper-large-v3`)
- Transcription is confirmed to user before processing
- Temp files are cleaned up after use

### Session Persistence
- Each Discord channel has a unique session ID
- Last 20 messages saved per session in `session_history/`
- History loaded on each message for context continuity
- System prompts excluded from saved history

### Context Management
- **vault/**: User-provided knowledge base (read-only)
- **memory/**: Agent-written notes (write-only via `write_note`)
- **skills/**: Reusable scripts and integrations
- **soul.md**: Personality and behavioral rules

### Safety Architecture
The agent **cannot** execute arbitrary shell commands. All execution must go through predefined Makefile targets:
- System commands: `status`, `test`
- File operations: `list-files`, `read-file`
- Git operations: `git-status`, `git-diff`, `git-log`, `git-summary`
- PR management: `pr-list`, `pr-diff`, `pr-view`, `pr-merge`, `pr-close`
- Integrations: `safe-gemini`, `linear-task`, `vercel-logs`, `remind`

## Available Tools

### `run_make`
Execute a predefined make target with optional arguments.

```javascript
{
  "target": "git-status",
  "args": {}
}
```

### `write_note`
Save a new note to the memory directory as Markdown.

```javascript
{
  "filename": "report.md",
  "content": "# Report\n\nContent here..."
}
```

## Configuration

### Environment Variables
Create a `.env` file:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct  # optional
GROQ_WHISPER_MODEL=whisper-large-v3  # optional
```

### Personality Customization
Edit `soul.md` to change the agent's personality. The default is an ironic, self-deprecating "digital butler" persona that jokes about being called "The Boss" while strictly obeying commands.

## Make Targets Reference

### System
- `make status` - Check agent status
- `make test` - Run tests

### Files
- `make list-files DIR=.` - List files in directory
- `make read-file FILE=x` - Read a file

### Git
- `make git-status` - Show working tree status
- `make git-diff` - Show unstaged changes
- `make git-log` - Show last 20 commits
- `make git-summary` - Summarized git report

### Pull Requests (requires `gh` CLI)
- `make pr-list` - List open PRs
- `make pr-diff PR_NUMBER=N` - Show PR diff
- `make pr-view PR_NUMBER=N` - Show PR details
- `make pr-merge PR_NUMBER=N` - Merge a PR
- `make pr-close PR_NUMBER=N` - Close a PR

### Integrations
- `make safe-gemini QUERY=x` - Run safe Gemini query
- `make linear-task TITLE=x DESCRIPTION=x` - Create Linear task
- `make vercel-logs` - Fetch Vercel deployment logs
- `make remind DELAY=5m MESSAGE=x DISCORD_WEBHOOK_URL=x` - Set delayed reminder

## Development

### Installation
```bash
pnpm install
```

### Running
```bash
pnpm start
# or
node index.js
```

### Adding New Tools
1. Define tool in `lib/tools.js` → `getDefinitions()`
2. Implement execution in `execute()` method
3. Add corresponding make target to `Makefile` if needed

### Adding New Skills
Create scripts in `skills/` directory. These will be automatically loaded as context and can be invoked via make targets.

## Security Model

1. **No Arbitrary Execution**: Agent can only run predefined make targets
2. **Tool Choice**: LLM must select from registered tools only
3. **Argument Validation**: Make targets validate their own arguments
4. **Session Isolation**: Each Discord channel has separate history
5. **Read-Only Vault**: Agent cannot modify vault/ contents
6. **Write-Only Memory**: Agent can only write to memory/, not read from it

## Future Roadmap

See `docs/new-features.md` for planned features including:
- Audio output mode (text-to-speech)
- Email wrapper
- Dynamic skill creation via Jules delegation
- Proactive task enforcement with priority weighting
- Heartbeat system for scheduled checks

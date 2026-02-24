# Boss Agent: The Digital Butler

Boss Agent is a sophisticated, safety-first AI assistant integrated with Discord. It leverages Groq's high-speed inference for LLM and Whisper (voice transcription) capabilities, featuring a local Retrieval-Augmented Generation (RAG) system and a strict execution model controlled by a central Makefile.

The agent adopts an ironic "Boss Operator" persona—constantly joking about its name while being a strictly obedient and highly efficient servant.

## Architecture

### Construction and Rationale
The Boss Agent is built on a modular, decoupled architecture designed for speed, security, and extensibility.

1.  **Discord as the Unified Interface**: Discord serves as the primary gateway, supporting both text and audio inputs. This allows for a rich, multi-modal interaction loop within a familiar communication platform.
2.  **Groq-Powered Dual-Modality**:
    -   **Text**: Uses Groq's fast inference for chat completions (e.g., Llama-3 based models).
    -   **Voice**: Uses `whisper-large-v3` via Groq for near-instant transcription of audio notes.
    -   **Rationale**: Conversational agents require ultra-low latency. Groq's LPU™ technology provides the speed necessary for a responsive experience, especially when processing voice commands.
3.  **The Makefile Gatekeeper**:
    -   All external tool executions are routed through a root-level `Makefile`.
    -   **Rationale**: This is the cornerstone of the agent's **Safety Architecture**. The agent never has direct shell access. It can only call predefined targets, which are audited, sanitized, and restricted by the `MakeExecutor`. This prevents arbitrary code execution vulnerabilities.
4.  **Local Filesystem RAG (Vault/Memory/Skills)**:
    -   The agent uses a TF-IDF based search over local Markdown files organized into `vault/` (static), `memory/` (dynamic), and `skills/` (scripts).
    -   **Rationale**: Local files are easy to version, audit, and modify without the overhead of a vector database. The `FileSystem` implements header-based chunking to ensure only the most relevant sections are injected into the context.
5.  **Token-Aware Context Management**:
    -   Uses `js-tiktoken` to implement a sliding window for session history and context retrieval.
    -   **Rationale**: By accurately counting tokens and prioritizing recent history and relevant RAG chunks, the agent avoids context window overflow and maintains instruction-following quality.
6.  **Nomenclature Middleware**:
    -   A dedicated service for resolving fuzzy or voice-transcribed identifiers (like repository names) against actual system records.
    -   **Rationale**: Bridges the gap between imprecise human input and the exact strings required by system tools (e.g., GitHub API).

### Component Overview
```
boss-agent/
├── index.ts              # Discord bot entry point & message loop
├── lib/                  # Core logic
│   ├── file_system.ts    # RAG, session management, and note-taking
│   ├── groq_provider.ts  # Groq LLM & Whisper integration
│   ├── make_executor.ts  # Secure Makefile target execution
│   ├── nomenclature.ts   # Fuzzy name resolution middleware
│   ├── provider.ts       # LLM provider interface
│   ├── shell_executor.ts # Low-level shell command handling
│   ├── tools.ts          # Tool registry and execution dispatcher
│   └── tools.json        # Tool definitions for the LLM
├── skills/               # External scripts and integrations (Gemini, Reminders, etc.)
├── vault/                # Read-only knowledge base (Markdown)
├── memory/               # Persistent agent-writable notes (Markdown)
├── tests/                # Jest and manual tests
├── docs/                 # Architectural and feature documentation
├── session_history/      # Per-channel JSON session logs
├── soul.md               # Agent personality definition
└── Makefile              # The central gatekeeper for all external actions
```

## Features

### Core Features
-   **Multi-Modal Interaction**: Seamlessly handles text and audio (voice note) inputs.
-   **Session Persistence**: Maintains conversation continuity per Discord channel, stored as JSON in `session_history/`.
-   **Semantic Context Retrieval**: Automatically retrieves relevant notes and skill documentation based on the user's query using TF-IDF and Markdown header-based chunking.
-   **Safety-First Tool Execution**: Restricts all actions to predefined, sanitized Makefile targets.

### Peripheral Features
-   **Git & GitHub Management**: Summarize commits, view PR diffs, and manage PRs (list, merge, close) via `gh` CLI.
-   **Task Integration**: Create and track issues in **Linear**.
-   **Web Intelligence**: Web search, deep research, and image generation via **Gemini** wrappers.
-   **Cloud Ops**: Fetch build and deployment logs from **Vercel**.
-   **Delayed Reminders**: Schedule notifications via Discord webhooks.
-   **Jules API Integration**: Direct interaction with Jules for complex engineering tasks and session management.

## Guidelines for Agents

To maintain the stability and security of the Boss Agent, all contributing agents must adhere to these specific guidelines:

1.  **Strict Makefile Interfacing**: **Never** use `exec` or `spawn` directly in new core code. Every external action must be added as a target in the `Makefile` and invoked via the `run_make` tool.
2.  **Argument Sanitization**: While `MakeExecutor` filters dangerous characters, new Makefile targets should perform their own validation to ensure robust execution.
3.  **ESM & TypeScript Compliance**: The project is a strict ES Module TypeScript project. Use `import` instead of `require` and maintain full type coverage.
4.  **Tool Registry Sync**: Any change to tool capabilities must be reflected in `lib/tools.json`. This file is the source of truth for the LLM's function call signatures.
5.  **Output Truncation Awareness**: The `MakeExecutor` truncates outputs at 5000 characters. Design tools to be concise or provide summarization if they are expected to produce large amounts of data.
6.  **Context Hygiene**: Do not flood the session history with large tool outputs. Use `write_note` to save detailed reports to `memory/` and refer the "Boss" to those files.
7.  **Test Before Submit**: Core logic in `lib/` must be verified using the Jest suite in `tests/jest/`. Run `pnpm test` before finalizing any changes.

## Development

### Setup
```bash
pnpm install
```

### Running
```bash
pnpm start
```

### Configuration
Create a `.env` file in the root:
```bash
DISCORD_BOT_TOKEN=...
GROQ_API_KEY=...
JULES_API_KEY=...
GEMINI_API_KEY=...
# Optional
GROQ_MODEL=...
GROQ_WHISPER_MODEL=...
```

## Security Model
1.  **No Arbitrary Execution**: The agent is restricted to `Makefile` targets.
2.  **Read-Only Vault**: The `vault/` directory is immutable for the agent.
3.  **Write-Only Memory**: The agent can create new notes in `memory/` but cannot modify existing ones after a short grace period (conceptual rule from `docs/architecture-planning.md`).
4.  **Session Isolation**: Histories are strictly separated by Discord channel IDs.

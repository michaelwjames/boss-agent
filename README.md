# Boss Agent: The Digital Butler

Boss Agent is a sophisticated, safety-first AI assistant integrated with Discord. It leverages Groq's high-speed inference for LLM and Whisper (voice transcription) capabilities, featuring a local Retrieval-Augmented Generation (RAG) system and a strict execution model controlled by a central Makefile.

The agent adopts an ironic "Boss Operator" persona—constantly joking about its name while being a strictly obedient and highly efficient servant.

## Architecture

### Construction and Rationale
The Boss Agent is built on a modular, decoupled architecture designed for speed, security, and extensibility.

1.  **Discord & Terminal as Interfaces**: Discord serves as the primary gateway, while a Terminal mode allows for local development and direct interaction.
2.  **Groq-Powered Dual-Modality**:
    -   **Text**: Uses Groq's fast inference for chat completions (e.g., Llama-3 based models).
    -   **Voice**: Uses `whisper-large-v3` via Groq for near-instant transcription of audio notes.
    -   **Rationale**: Ultra-low latency is critical for conversational agents.
3.  **The Makefile Gatekeeper**:
    -   All external tool executions are routed through a root-level `Makefile`.
    -   **Rationale**: Cornerstone of the **Safety Architecture**. The agent never has direct shell access.
4.  **Local Filesystem RAG (Vault/Memory/Skills)**:
    -   TF-IDF based search over local Markdown files.
    -   **Rationale**: Easy to version, audit, and modify.
5.  **Token-Aware Context Management**:
    -   Uses `js-tiktoken` and a `TokenTracker` to implement a sliding window and monitor context window usage.
6.  **Interceptor Pipeline**:
    -   A middleware-inspired pipeline for tool execution, allowing for logging, token truncation, and output sanitization.
7.  **Autonomous Kairos Engine**:
    -   A synthetic heartbeat ("tick") engine that allows the agent to perform proactive checks and background tasks.

### Component Overview
```
boss-agent/
├── app/
│   ├── index.ts              # Entry point & message loop (Discord/Terminal)
│   └── lib/                  # Core logic
│       ├── adapters/         # Input/Output adapters (Terminal)
│       ├── analytics/        # Token tracking and context usage
│       ├── config/           # Static tool definitions (tools.json)
│       ├── core/             # LLM provider abstractions
│       ├── data/             # File system and session persistence
│       ├── engine/           # Autonomous engines (Kairos)
│       ├── executors/        # Secure Makefile/Shell execution
│       ├── interceptors/     # Tool execution middleware pipeline
│       ├── services/         # High-level background services (Compression)
│       ├── tools/            # Concrete tool implementations (Jules, etc.)
│       ├── utils/            # Logging and nomenclature utilities
│       ├── history_sanitizer.ts # Session history cleaning
│       └── tools.ts          # Tool registry and execution dispatcher
├── data/
│   ├── skills/               # External scripts and integrations
│   ├── vault/                # Read-only knowledge base (Markdown)
│   ├── memory/               # Persistent agent-writable notes (Markdown)
│   ├── large_outputs/        # Storage for truncated tool results
│   └── session_history/      # Per-channel JSON session logs
├── tests/                    # Jest and manual tests
├── docs/                     # Architectural and feature documentation
├── soul.md                   # Agent personality definition
└── Makefile                  # The central gatekeeper for all external actions
```

## Features

### Core Features
-   **Multi-Modal Interaction**: Seamlessly handles text and audio (voice note) inputs.
-   **Multi-Interface Support**: Operate via Discord or local Terminal mode.
-   **Autonomous Behavior (Kairos)**: Periodically wakes up to check for pending tasks or required actions.
-   **Parallel Tool Execution**: Executes multiple tool calls simultaneously to reduce response latency.
-   **Session Persistence & Compression**: Maintains conversation continuity with background history compression to optimize context window usage.
-   **Semantic Context Retrieval**: Automatically retrieves relevant notes and skill documentation based on the user's query using TF-IDF and Markdown header-based chunking.
-   **Safety-First Tool Execution**: Restricts all actions to predefined, sanitized Makefile targets.

### Peripheral Features
-   **Jules AI Integration**: Direct, deep interaction with the Jules AI agent for complex engineering tasks, plan approval, and session management.
-   **Git & GitHub Management**: Summarize commits, view PR diffs, and manage PRs (list, merge, close) via `gh` CLI.
-   **Task Integration**: Create and track issues in **Linear**.
-   **Web Intelligence**: Web search, deep research, and image generation via **Gemini** wrappers.
-   **Cloud Ops**: Fetch build and deployment logs from **Vercel**.
-   **Delayed Reminders**: Schedule notifications via Discord webhooks.

## Guidelines for Agents

To maintain the stability and security of the Boss Agent, all contributing agents must adhere to these specific guidelines:

1.  **Strict Makefile Interfacing**: **Never** use `exec` or `spawn` directly in new core code. Every external action must be added as a target in the `Makefile` and invoked via the `run_make` tool.
2.  **Use Dedicated Tools for External Agents**: For interacting with external agents like Jules, **always** use the dedicated tool (e.g., `jules`) instead of invoking Makefile targets directly via `run_make`.
3.  **Interceptor Pipeline Awareness**: Be aware of the `Interceptor` pipeline in `app/lib/interceptors/`. New cross-cutting concerns (logging, truncation, etc.) should be implemented as interceptors.
4.  **Argument Sanitization**: While `MakeExecutor` filters dangerous characters, new Makefile targets should perform their own validation to ensure robust execution.
5.  **ESM & TypeScript Compliance**: The project is a strict ES Module TypeScript project. Use `import` instead of `require` and maintain full type coverage.
6.  **Tool Registry Sync**: Any change to tool capabilities must be reflected in `app/lib/config/tools.json`. This file is the source of truth for the LLM's function call signatures.
7.  **Output Truncation Awareness**: Tools may produce large outputs. The `TokenTruncationInterceptor` automatically handles very large outputs by saving them to `data/large_outputs/` and providing a link.
8.  **Context Hygiene**: Do not flood the session history with large tool outputs. Use `write_note` to save detailed reports to `memory/` and refer the "Boss" to those files.
9.  **Test Before Submit**: Core logic in `app/lib/` must be verified using the Jest suite in `tests/`. Run `pnpm test` before finalizing any changes.

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
# Core API Keys
DISCORD_BOT_TOKEN=...
GROQ_API_KEY=...
JULES_API_KEY=...
GEMINI_API_KEY=...

# Model Selection
GROQ_MODEL=...             # Primary model (e.g., llama-3.3-70b-versatile)
GROQ_MODEL_2=...           # Fallback model 1
GROQ_MODEL_3=...           # Fallback model 2
GROQ_WHISPER_MODEL=...     # Model for transcription (whisper-large-v3)

# Agent Behavior
TERMINAL_MODE=false        # Set to true for local CLI interaction
KAIROS_ENABLED=true        # Enable autonomous proactive mode
COMPRESSION_ENABLED=true   # Enable background history compression
MAX_TOOL_ROUNDS=10         # Limit on consecutive tool calls per user message
DEBUG=false                # Set to true for verbose logging
```

## Security Model
1.  **No Arbitrary Execution**: The agent is restricted to `Makefile` targets.
2.  **Read-Only Vault**: The `vault/` directory is immutable for the agent.
3.  **Write-Only Memory**: The agent can create new notes in `memory/` but cannot modify existing ones after a short grace period (conceptual rule from `docs/architecture-planning.md`).
4.  **Session Isolation**: Histories are strictly separated by Discord channel IDs.

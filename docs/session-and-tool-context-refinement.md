# Session and Tool Context Refinement

This document details the architectural refinements made to the Boss Agent's session management and tool execution pipeline. These changes optimize context window usage, improve user transparency, and ensure session freshness.

## 1. Tool Context Architecture

The `Tool` interface has been enhanced to support a `ToolContext`. This allows tools to interact directly with the environment (e.g., sending messages to Discord) independently of the LLM's response cycle.

### Implementation Detail
- **Location**: `app/lib/tools/base.ts`
- **Context Object**:
  ```typescript
  export interface ToolContext {
    sessionId: string;
    send: (content: string) => Promise<any>;
  }
  ```
- **Execution**: The `ToolRegistry` passes this context to every tool's `execute` method.

### Benefits
- Tools can provide immediate, high-volume feedback to the user without bloating the LLM's context window.
- Decouples tool execution from the final LLM response.

---

## 2. The "Display-and-Truncate" Pattern (Jules Tool)

To handle the large outputs of the Jules CLI, we implemented a pattern that provides full information to the user while keeping the LLM context lean.

### How it Works
1. The `JulesTool` executes the requested action.
2. It sends the **full** output directly to the Discord channel using `context.send()`.
3. it returns a **truncated** version (preview) to the LLM for its immediate reasoning turn.
4. It attaches the full output to an internal field `_fullStdout` for history persistence.

### Code Reference
- `app/lib/tools/jules.ts`

---

## 3. History Sanitization and Persistence

To ensure the LLM can "remember" full tool outputs if specifically asked later, we use a sanitization pipeline during session saving.

### Components
- **`stripInternalFields`**: Removes `_fullStdout` before the tool result is added back to the active `messages` array in the reasoning loop. This keeps the *current* context window small.
- **`sanitizeHistory`**: Before saving to `data/session_history/`, it restores `_fullStdout` to the main `stdout` field. This ensures that *future* loads of the session history contain the full data.

### Code Reference
- `app/lib/history_sanitizer.ts`
- `app/index.ts` (Integration in the tool loop and `saveSession` call)

---

## 4. 10-Minute Session Rotation Rule

To maintain context relevance and prevent "hallucination carry-over" from stale interactions, the agent now enforces a 10-minute inactivity rule.

### Logic
- Every time `FileSystem.loadSession(sessionId)` is called:
  1. It checks the last modified time (`mtimeMs`) of the session file.
  2. If the file is older than **10 minutes**, it is renamed to an archive format: `{sessionId}_{ISO_TIMESTAMP}.json`.
  3. A new, empty history is returned for the current interaction.

### Benefits
- Ensures the agent doesn't get confused by old, unrelated tasks.
- Automates session "cleaning" without user intervention.

### Code Reference
- `app/lib/data/file_system.ts`

---

## 5. Guidelines for Future Integrations

### Implementing a New "High-Volume" Tool
If you are adding a tool that produces large amounts of text (e.g., a log fetcher or a file searcher):
1. **Use the Context**: Call `context.send()` to show the user the raw data.
2. **Truncate for LLM**: Return a summary or a "Top 10" preview to the LLM.
3. **Persist Full Data**: Use the `_fullStdout` pattern if the full data might be needed in a follow-up question.
4. **Register in Sanitizer**: Add the tool name to `app/lib/history_sanitizer.ts` if special restoration logic is needed.

### Testing Session Logic
Always add tests to `tests/jest/session_rotation.test.ts` or similar when modifying history loading/saving behavior.

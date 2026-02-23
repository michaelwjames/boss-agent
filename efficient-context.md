# Report: Efficient Context Management for Boss Agent

## 1. Executive Summary
The Boss Agent infrastructure currently employs a Retrieval-Augmented Generation (RAG) system and session history management that, while functional, are prone to "context ballooning." This report identifies the primary dangers of the existing setup and proposes concrete mitigation strategies to ensure long-term stability, performance, and cost-efficiency.

## 2. Existing Context Architecture
Currently, the context sent to the LLM (Groq) is composed of:
- **System Prompt:** Hardcoded rules + `soul.md`.
- **Vault/Memory/Skills:** Up to 9 full files (top 3 from each directory) based on TF-IDF/keyword search.
- **Session History:** The last 10 messages (for initial prompt) or 20 messages (stored for next session).

## 3. Main Dangers of Context Ballooning

### 3.1. Context Window Overflow
The current model (`llama3-70b-8192`) has a context window of 8,192 tokens.
- **Full File Retrieval:** Loading 9 full Markdown files can easily consume several thousand tokens. If individual notes are large, this alone can exceed the limit.
- **Unbounded History:** While the *number* of messages is limited to 10-20, the *size* of each message is not. A single tool output (e.g., `git diff` or `vercel-logs`) could be hundreds of lines long, potentially consuming the entire context window in one turn.

### 3.2. Performance Degradation (Latency)
As the context size approaches the limit, the time-to-first-token and overall inference time increase. This leads to a sluggish experience for the "Boss," especially when interacting via voice.

### 3.3. Attention Dilution (Lost in the Middle)
LLMs often struggle to retrieve information from the middle of very long contexts. Providing entire files when only a specific paragraph is relevant increases the noise-to-signal ratio, potentially leading to hallucination or failure to follow instructions.

### 3.4. Lack of Token Awareness
The current `index.js` and `file_system.js` do not perform any token counting. The agent "flies blind," only discovering context issues when the API returns an error.

## 4. Mitigation Strategies

### 4.1. Granular RAG (Chunking)
Instead of retrieving entire files, implement a chunking strategy:
- **Header-based Splitting:** Split Markdown files by `#` or `##` headers.
- **Sentence-based Splitting:** Use a fixed window of sentences or paragraphs.
- **Benefit:** Only the most relevant sections of a file are sent, significantly reducing token usage.

### 4.2. Tool Output Truncation
Implement a middleware or logic in `ToolRegistry` to truncate tool outputs:
- **Limit STDOUT/STDERR:** If an output exceeds 100 lines or 2000 characters, truncate it and append a message like `[Output truncated... use 'read-file' to see full content]`.
- **Selective Retrieval:** For commands like `git diff`, encourage the agent to request specific files if the global diff is too large.

### 4.3. Token-Aware Sliding Window
Replace the fixed 10-message slice with a token-aware sliding window:
- **Pre-flight Token Count:** Count tokens for the system prompt and then add as many history messages as possible until a "safety threshold" (e.g., 6000 tokens) is reached.
- **Priority:** Always prioritize the most recent messages.

### 4.4. Context Summarization
Implement an automated summarization step for long-running sessions:
- When history exceeds a certain length, use a cheaper/faster model to summarize the "story so far" and replace older messages with this summary.

### 4.5. Metadata-Only Search
Modify `readAllNotes` to first show the agent a list of relevant filenames and snippets. Let the agent *decide* which ones to read in full using a tool. This shifts the "retrieval" burden to the agent's logic rather than being an automatic prepending.

## 5. Implementation Roadmap
1. **Short Term:** Add output truncation to `make_executor.js`.
2. **Medium Term:** Integrate a token counting library (e.g., `js-tiktoken`) into `index.js`.
3. **Long Term:** Refactor `file_system.js` to support header-based chunking and vector embeddings for more accurate retrieval.

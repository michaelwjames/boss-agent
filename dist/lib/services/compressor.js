/**
 * Service to compress session history by summarizing older messages.
 */
export class MemoryCompressor {
    groq;
    fs;
    model = 'llama-3.3-70b-versatile';
    constructor(groq, fs) {
        this.groq = groq;
        this.fs = fs;
    }
    /**
     * Compresses the session history by summarizing older turns.
     * Keeps the last 5 turns intact.
     */
    async compressSession(sessionId, history) {
        if (history.length <= 10)
            return; // Not enough history to warrant compression
        console.log(`[COMPRESSOR] Starting compression for session: ${sessionId}`);
        // Split history: messages to compress and recent messages to keep
        const KEEP_RECENT = 5;
        const toCompress = history.slice(0, history.length - KEEP_RECENT);
        const recent = history.slice(history.length - KEEP_RECENT);
        // Build the summarization prompt
        const summarizationMessages = [
            {
                role: 'system',
                content: 'You are a session memory compressor. Your goal is to write a dense, concise summary of the conversation so far, focusing on decisions made, facts established, and the current state of the task. Do not lose critical context. Be brief.'
            },
            {
                role: 'user',
                content: `Please summarize the following conversation history:\n\n${JSON.stringify(toCompress, null, 2)}`
            }
        ];
        try {
            const summaryResponse = await this.groq.chat(summarizationMessages, []);
            const summaryText = summaryResponse.content;
            const compressedHistory = [
                {
                    role: 'system',
                    content: `SUMMARY OF PREVIOUS TURNS: ${summaryText}`
                },
                ...recent
            ];
            await this.fs.saveSession(sessionId, compressedHistory);
            console.log(`[COMPRESSOR] Compression complete for session: ${sessionId}`);
        }
        catch (error) {
            console.error(`[COMPRESSOR] Error during compression:`, error);
        }
    }
}

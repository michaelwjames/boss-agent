/**
 * Interceptor that truncates tool output to stay within safe token limits.
 * Default threshold is 2000 tokens.
 */
export class TokenTruncationInterceptor {
    tokenTracker;
    threshold;
    constructor(tokenTracker, threshold = 2000) {
        this.tokenTracker = tokenTracker;
        this.threshold = threshold;
    }
    async postExecute(toolName, args, result) {
        const tokenCount = this.tokenTracker.countTokens(result);
        if (tokenCount > this.threshold) {
            console.log(`[TRUNCATION] Tool "${toolName}" output (${tokenCount} tokens) exceeds threshold (${this.threshold}). Truncating...`);
            // Rough character-to-token estimate (approx 4 chars per token)
            // We take slightly less than the threshold to be safe
            const targetLength = this.threshold * 3.5;
            const truncated = result.slice(0, targetLength);
            return `${truncated}\n\n[Output truncated due to token limits (${tokenCount} tokens). Use 'read-file' or run with specific filters to see more.]`;
        }
        return result;
    }
}

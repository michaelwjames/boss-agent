import { getEncoding } from 'js-tiktoken';
export class TokenTracker {
    enc = getEncoding('cl100k_base');
    // Model limits based on Groq documentation
    modelLimits = {
        'meta-llama/llama-4-scout-17b-16e-instruct': {
            name: 'LLaMA 4 Scout 17B',
            contextWindow: 128000,
            rpm: 1000,
            rpd: 14400,
            tpm: 30000,
            tpd: 500000
        },
        'llama-3.3-70b-versatile': {
            name: 'LLaMA 3.3 70B',
            contextWindow: 128000,
            rpm: 30,
            rpd: 14400,
            tpm: 20000,
            tpd: 500000
        },
        'groq/compound': {
            name: 'Groq Compound',
            contextWindow: 32768,
            rpm: 30,
            rpd: 14400,
            tpm: 7000,
            tpd: 100000
        },
        'groq/compound-mini': {
            name: 'Groq Compound Mini',
            contextWindow: 8192,
            rpm: 30,
            rpd: 14400,
            tpm: 7000,
            tpd: 100000
        },
        'mixtral-8x7b-32768': {
            name: 'Mixtral 8x7B',
            contextWindow: 32768,
            rpm: 30,
            rpd: 14400,
            tpm: 5000,
            tpd: 500000
        }
    };
    requestLog = [];
    getModelLimits(modelName) {
        return this.modelLimits[modelName] || {
            name: modelName,
            contextWindow: 8192,
            rpm: 30,
            rpd: 14400,
            tpm: 5000,
            tpd: 100000
        };
    }
    countTokens(text) {
        return this.enc.encode(text).length;
    }
    calculateContextStats(systemPrompt, history, userMessage, toolDefs, modelName) {
        const limits = this.getModelLimits(modelName);
        const systemPromptTokens = this.countTokens(systemPrompt);
        const userMessageTokens = this.countTokens(userMessage);
        const toolDefinitionsTokens = this.countTokens(JSON.stringify(toolDefs));
        let historyTokens = 0;
        for (const msg of history) {
            const content = msg.content || JSON.stringify(msg.tool_calls || '');
            historyTokens += this.countTokens(content);
        }
        const currentContextTokens = systemPromptTokens + historyTokens + userMessageTokens + toolDefinitionsTokens;
        const percentOfContextWindow = (currentContextTokens / limits.contextWindow) * 100;
        const remainingContextTokens = limits.contextWindow - currentContextTokens;
        // Estimate response tokens (typically 10-20% of context or max 4096)
        const estimatedResponseTokens = Math.min(4096, Math.floor(limits.contextWindow * 0.15));
        return {
            currentContextTokens,
            systemPromptTokens,
            historyTokens,
            userMessageTokens,
            toolDefinitionsTokens,
            percentOfContextWindow,
            remainingContextTokens,
            estimatedResponseTokens
        };
    }
    logRequest(tokens) {
        const now = Date.now();
        this.requestLog.push({ timestamp: now, tokens });
        // Clean up old entries (older than 24 hours)
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        this.requestLog = this.requestLog.filter(r => r.timestamp > oneDayAgo);
    }
    getRateLimitStats(modelName) {
        const limits = this.getModelLimits(modelName);
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const recentMinute = this.requestLog.filter(r => r.timestamp > oneMinuteAgo);
        const recentDay = this.requestLog.filter(r => r.timestamp > oneDayAgo);
        const requestsThisMinute = recentMinute.length;
        const tokensThisMinute = recentMinute.reduce((sum, r) => sum + r.tokens, 0);
        const tokensThisDay = recentDay.reduce((sum, r) => sum + r.tokens, 0);
        return {
            model: limits.name,
            requestsThisMinute,
            tokensThisMinute,
            tokensThisDay,
            limits,
            percentOfTPM: (tokensThisMinute / limits.tpm) * 100,
            percentOfTPD: (tokensThisDay / limits.tpd) * 100,
            percentOfRPM: (requestsThisMinute / limits.rpm) * 100
        };
    }
    calculateTokenSavings(originalTokens, optimizedTokens) {
        const savedTokens = originalTokens - optimizedTokens;
        const percentSaved = (savedTokens / originalTokens) * 100;
        let strategy = 'Unknown';
        if (percentSaved > 50) {
            strategy = 'Aggressive context pruning (>50% reduction)';
        }
        else if (percentSaved > 25) {
            strategy = 'Moderate context pruning (25-50% reduction)';
        }
        else if (percentSaved > 10) {
            strategy = 'Light context pruning (10-25% reduction)';
        }
        else {
            strategy = 'Minimal optimization (<10% reduction)';
        }
        return { savedTokens, percentSaved, strategy };
    }
    formatStats(contextStats, rateLimitStats) {
        return `
📊 **Context Window Stats**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model: \${rateLimitStats.model}
Context Window: \${rateLimitStats.limits.contextWindow.toLocaleString()} tokens

**Current Usage:**
• Total Context: \${contextStats.currentContextTokens.toLocaleString()} tokens (\${contextStats.percentOfContextWindow.toFixed(1)}%)
• System Prompt: \${contextStats.systemPromptTokens.toLocaleString()} tokens
• History: \${contextStats.historyTokens.toLocaleString()} tokens
• User Message: \${contextStats.userMessageTokens.toLocaleString()} tokens
• Tool Definitions: \${contextStats.toolDefinitionsTokens.toLocaleString()} tokens

**Remaining:**
• Available: \${contextStats.remainingContextTokens.toLocaleString()} tokens
• Est. Response: ~\${contextStats.estimatedResponseTokens.toLocaleString()} tokens

⚡ **Rate Limit Stats**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Requests:**
• This Minute: \${rateLimitStats.requestsThisMinute}/\${rateLimitStats.limits.rpm} (\${rateLimitStats.percentOfRPM.toFixed(1)}%)

**Tokens:**
• This Minute: \${rateLimitStats.tokensThisMinute.toLocaleString()}/\${rateLimitStats.limits.tpm.toLocaleString()} (\${rateLimitStats.percentOfTPM.toFixed(1)}%)
• Today: \${rateLimitStats.tokensThisDay.toLocaleString()}/\${rateLimitStats.limits.tpd.toLocaleString()} (\${rateLimitStats.percentOfTPD.toFixed(1)}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    }
}

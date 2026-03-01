import { Tool } from './base.js';
import { TokenTracker } from '../analytics/token_tracker.js';

/**
 * Tool to get detailed context statistics and rate limit status.
 */
export class GetContextStatsTool implements Tool {
  private tokenTracker: TokenTracker;

  constructor(tokenTracker: TokenTracker) {
    this.tokenTracker = tokenTracker;
  }

  async execute(args: any): Promise<string> {
    const model = args?.model || 'meta-llama/llama-4-scout-17b-16e-instruct';
    const rateLimitStats = this.tokenTracker.getRateLimitStats(model);
    return `Current rate limit stats for ${rateLimitStats.model}:\n${JSON.stringify(rateLimitStats, null, 2)}`;
  }
}

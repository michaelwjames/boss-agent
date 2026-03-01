import { ToolInterceptor } from './base.js';
import { TokenTracker } from '../analytics/token_tracker.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Interceptor that saves large tool outputs to files instead of truncating them.
 * Default threshold is 2000 tokens.
 */
export class TokenTruncationInterceptor implements ToolInterceptor {
  private tokenTracker: TokenTracker;
  private threshold: number;
  private projectRoot: string;

  constructor(tokenTracker: TokenTracker, threshold = 2000) {
    this.tokenTracker = tokenTracker;
    this.threshold = threshold;
    this.projectRoot = path.resolve();
  }

  async postExecute(toolName: string, args: any, result: string): Promise<string> {
    const tokenCount = this.tokenTracker.countTokens(result);

    if (tokenCount > this.threshold) {
      console.log(`[TRUNCATION] Tool "${toolName}" output (${tokenCount} tokens) exceeds threshold (${this.threshold}). Saving to file...`);
      
      // Save the large output to a file
      const outputDir = path.join(this.projectRoot, 'data', 'large_outputs');
      await fs.ensureDir(outputDir);
      
      const outputFilename = `${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.txt`;
      const filepath = path.join(outputDir, outputFilename);
      
      await fs.writeFile(filepath, result, 'utf-8');
      
      const contentLength = result.length;
      
      return `[LARGE OUTPUT SAVED]
Tool: ${toolName}
File: data/large_outputs/${outputFilename}
Size: ${contentLength} characters (${tokenCount} tokens)

The large output has been saved to a file to avoid consuming ${tokenCount} tokens from your context budget.

You can:
1. Use 'read_memory' to read specific sections: read_memory with filename "large_outputs/${outputFilename}"
2. Use shell commands to filter/search: cat data/large_outputs/${outputFilename} | grep "pattern"
3. View the file directly in your IDE

First 500 characters preview:
${result.slice(0, 500)}...`;
    }

    return result;
  }
}

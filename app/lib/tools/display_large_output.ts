import { Tool } from './base.js';
import { FileSystem } from '../data/file_system.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Tool to display large outputs without consuming context tokens.
 * Writes output to a file and returns a reference instead of the full content.
 */
export class DisplayLargeOutputTool implements Tool {
  private fs: FileSystem;
  private projectRoot: string;

  constructor(fs: FileSystem) {
    this.fs = fs;
    this.projectRoot = path.resolve();
  }

  async execute(args: any): Promise<string> {
    const { content, filename } = args;

    if (!content) {
      return 'Error: content is required';
    }

    // Generate a unique filename if not provided
    const outputFilename = filename || `large_output_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.txt`;
    const outputDir = path.join(this.projectRoot, 'data', 'large_outputs');
    const filepath = path.join(outputDir, outputFilename);

    try {
      // Ensure the directory exists
      await fs.ensureDir(outputDir);

      // Write the content to the file
      await fs.writeFile(filepath, content, 'utf-8');

      const contentLength = content.length;
      const estimatedTokens = Math.ceil(contentLength / 4); // Rough estimate

      return `[LARGE OUTPUT SAVED]
File: data/large_outputs/${outputFilename}
Size: ${contentLength} characters (~${estimatedTokens} tokens)

The large output has been saved to a file. You can:
1. Use 'read_memory' to read specific sections: read_memory with filename "large_outputs/${outputFilename}"
2. Use shell commands to filter/search: cat data/large_outputs/${outputFilename} | grep "pattern"
3. View the file directly in your IDE

This approach avoids consuming ${estimatedTokens} tokens from your context budget.]`;
    } catch (error: any) {
      return `Error saving large output: ${error.message}`;
    }
  }
}

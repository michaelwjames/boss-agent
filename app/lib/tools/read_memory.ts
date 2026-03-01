import { Tool } from './base.js';
import { FileSystem } from '../data/file_system.js';

/**
 * Tool to read the full content of a file from the vault, memory, or skills directory.
 */
export class ReadMemoryTool implements Tool {
  private fs: FileSystem;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }

  async execute(args: any): Promise<string> {
    try {
      return await this.fs.readFileContent(args.filename);
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
}

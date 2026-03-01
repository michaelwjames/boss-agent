import { Tool } from './base.js';
import { FileSystem } from '../data/file_system.js';

/**
 * Tool to save a note as a Markdown file.
 */
export class WriteNoteTool implements Tool {
  private fs: FileSystem;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }

  async execute(args: any): Promise<string> {
    return await this.fs.writeNote(args.filename, args.content);
  }
}

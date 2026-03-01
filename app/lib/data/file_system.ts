import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FileContent {
  file: string;
  content: string;
  chunkId?: number | null;
}

export interface ScoredFile extends FileContent {
  score: number;
}

export type FileChunk = FileContent;

export class FileSystem {
  private vaultPath: string;
  private memoryPath: string;
  private skillsPath: string;
  private soulPath: string;

  constructor(vaultPath?: string, memoryPath?: string, skillsPath?: string) {
    // Resolve paths relative to the project root (two levels up from this file: app/lib/file_system.ts)
    const projectRoot = path.resolve(__dirname, '..', '..');
    this.vaultPath = vaultPath || path.join(projectRoot, 'data', 'vault');
    this.memoryPath = memoryPath || path.join(projectRoot, 'data', 'memory');
    this.skillsPath = skillsPath || path.join(projectRoot, 'data', 'skills');
    this.soulPath = path.join(projectRoot, 'data', 'soul.md');
  }

  async loadSoulPrompt(): Promise<string> {
    try {
      if (await fs.pathExists(this.soulPath)) {
        return await fs.readFile(this.soulPath, 'utf-8');
      }
    } catch {
      // soul.md is optional
    }
    return '';
  }


  /**
   * Returns a lightweight index of all available files in vault, memory, and skills.
   */
  async getFileSystemIndex(): Promise<string> {
    const vaultFiles = await this._readDir(this.vaultPath);
    const memoryFiles = await this._readDir(this.memoryPath);
    const skillsFiles = await this._readDir(this.skillsPath);

    let index = "--- FILE SYSTEM INDEX ---\n";
    
    index += "\n[VAULT (data/vault/)]\n";
    index += vaultFiles.length > 0 
      ? vaultFiles.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No vault notes found.\n";

    index += "\n\n[MEMORY (data/memory/)]\n";
    index += memoryFiles.length > 0
      ? memoryFiles.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No memory notes found.\n";

    index += "\n\n[SKILLS (data/skills/)]\n";
    index += skillsFiles.length > 0
      ? skillsFiles.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No skills found.\n";

    return index;
  }

  async readFileContent(filename: string): Promise<string> {
    // Security: Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Invalid filename: path traversal not allowed');
    }
    
    const paths = [
      path.join(this.vaultPath, filename),
      path.join(this.memoryPath, filename),
      path.join(this.skillsPath, filename),
      // Also try with .md if not present
      path.join(this.vaultPath, `${filename}.md`),
      path.join(this.memoryPath, `${filename}.md`),
      path.join(this.skillsPath, `${filename}.md`),
    ];

    for (const p of paths) {
      if (await fs.pathExists(p) && (await fs.stat(p)).isFile()) {
        return await fs.readFile(p, 'utf-8');
      }
    }

    throw new Error(`File not found: ${filename}`);
  }

  /**
   * Split a Markdown file into chunks based on headers
   */
  private _chunkFile({ file, content }: FileContent): FileChunk[] {
    // If file is small, return as single chunk
    if (content.length < 2000) {
      return [{ file, content, chunkId: null }];
    }

    const chunks: FileChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentSize = 0;
    let chunkCount = 0;

    for (const line of lines) {
      // Split on major headers if chunk is already getting large
      if (line.startsWith('#') && currentSize > 1000) {
        chunks.push({
          file,
          content: currentChunk.join('\n'),
          chunkId: ++chunkCount
        });
        currentChunk = [];
        currentSize = 0;
      }
      currentChunk.push(line);
      currentSize += line.length;

      // Hard limit on chunk size
      if (currentSize > 3000) {
        chunks.push({
          file,
          content: currentChunk.join('\n'),
          chunkId: ++chunkCount
        });
        currentChunk = [];
        currentSize = 0;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        file,
        content: currentChunk.join('\n'),
        chunkId: ++chunkCount
      });
    }

    return chunks;
  }

  private async _readDir(dirPath: string): Promise<FileContent[]> {
    if (!await fs.pathExists(dirPath)) return [];
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const contents: FileContent[] = [];
    for (const file of mdFiles) {
      const filePath = path.join(dirPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      contents.push({ file, content });
    }
    return contents;
  }


  async writeNote(filename: string, content: string): Promise<string> {
    if (!filename.endsWith('.md')) filename += '.md';
    const filePath = path.join(this.memoryPath, filename);
    await fs.ensureDir(this.memoryPath);
    await fs.writeFile(filePath, content, 'utf-8');
    return `Note saved to ${filename}`;
  }

  async saveSession(sessionId: string, messages: any[]): Promise<void> {
    const sessionDir = './session_history';
    if (!await fs.pathExists(sessionDir)) await fs.mkdirp(sessionDir);
    const filePath = path.join(sessionDir, `${sessionId}.json`);
    await fs.writeJson(filePath, messages, { spaces: 2 });
  }

  async loadSession(sessionId: string): Promise<any[]> {
    const filePath = path.join('./session_history', `${sessionId}.json`);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return [];
  }
}

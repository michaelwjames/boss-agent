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
  private projectRoot: string;
  private vaultPath: string;
  private memoryPath: string;
  private skillsPath: string;
  private largeOutputsPath: string;
  private sessionHistoryPath: string;
  private soulPath: string;

  constructor(vaultPath?: string, memoryPath?: string, skillsPath?: string) {
    const possibleRoot = path.resolve(__dirname, '..', '..', '..');
    this.projectRoot = (possibleRoot === '/' || possibleRoot.includes('tests')) ? process.cwd() : possibleRoot;

    if (!this.projectRoot || this.projectRoot === '/') {
      this.projectRoot = '/app';
    }

    this.vaultPath = vaultPath || path.join(this.projectRoot, 'data', 'vault');
    this.memoryPath = memoryPath || path.join(this.projectRoot, 'data', 'memory');
    this.skillsPath = skillsPath || path.join(this.projectRoot, 'data', 'skills');
    this.largeOutputsPath = path.join(this.projectRoot, 'data', 'large_outputs');
    this.sessionHistoryPath = path.join(this.projectRoot, 'data', 'session_history');
    this.soulPath = path.join(this.projectRoot, 'data', 'soul.md');
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

  async getFileSystemIndex(): Promise<string> {
    const vaultFiles = await this._readDir(this.vaultPath);
    const memoryFiles = await this._readDir(this.memoryPath);
    const skillsFiles = await this._readDir(this.skillsPath);
    const largeOutputs = await this._readDir(this.largeOutputsPath, false);
    const sessions = await this._readDir(this.sessionHistoryPath, false);

    let index = "--- FILE SYSTEM INDEX ---\n";
    
    index += "\n[VAULT (data/vault/)]\n";
    index += vaultFiles.length > 0 
      ? vaultFiles.map(f => {
          const isAlways = f.content.includes('always_remember: true');
          return `- ${f.file} (${f.content.length} bytes)${isAlways ? ' [ALWAYS_REMEMBER]' : ''}`;
        }).join('\n')
      : "No vault notes found.\n";

    index += "\n\n[MEMORY (data/memory/)]\n";
    index += memoryFiles.length > 0
      ? memoryFiles.map(f => {
          const isAlways = f.content.includes('always_remember: true');
          return `- ${f.file} (${f.content.length} bytes)${isAlways ? ' [ALWAYS_REMEMBER]' : ''}`;
        }).join('\n')
      : "No memory notes found.\n";

    index += "\n\n[SKILLS (data/skills/)]\n";
    index += skillsFiles.length > 0
      ? skillsFiles.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No skills found.\n";

    index += "\n\n[LARGE OUTPUTS (data/large_outputs/)]\n";
    index += largeOutputs.length > 0
      ? largeOutputs.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No large outputs found.\n";

    index += "\n\n[SESSION HISTORY (data/session_history/)]\n";
    index += sessions.length > 0
      ? sessions.map(f => `- ${f.file} (${f.content.length} bytes)`).join('\n')
      : "No session history found.\n";

    return index;
  }

  async readFileContent(filename: string): Promise<string> {
    const normalizedPath = path.normalize(filename);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid filename: path traversal or absolute path not allowed');
    }
    
    const allowedRoots = [
      this.vaultPath,
      this.memoryPath,
      this.skillsPath,
      this.largeOutputsPath,
      this.sessionHistoryPath
    ];

    const candidates = [];

    const dataRoot = path.join(this.projectRoot, 'data');
    candidates.push(path.join(dataRoot, filename));

    for (const root of allowedRoots) {
      candidates.push(path.join(root, filename));
      if (!filename.endsWith('.md')) {
        candidates.push(path.join(root, `${filename}.md`));
      }
    }

    for (const p of candidates) {
      const resolved = path.resolve(p);
      const isAllowed = allowedRoots.some(root => resolved.startsWith(path.resolve(root)));

      if (isAllowed && await fs.pathExists(resolved) && (await fs.stat(resolved)).isFile()) {
        return await fs.readFile(resolved, 'utf-8');
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

  private async _readDir(dirPath: string, mdOnly = true): Promise<FileContent[]> {
    if (!await fs.pathExists(dirPath)) return [];
    const files = await fs.readdir(dirPath);
    const targetFiles = mdOnly ? files.filter(f => f.endsWith('.md')) : files;

    const contents: FileContent[] = [];
    for (const file of targetFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          contents.push({ file, content });
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
    return contents;
  }

  async writeNote(filename: string, content: string): Promise<string> {
    if (!filename.endsWith('.md')) filename += '.md';
    const filePath = path.join(this.memoryPath, filename);
    await fs.ensureDir(this.memoryPath);

    let finalContent = content;

    if (!content.trim().startsWith('---')) {
      const title = filename.replace('.md', '').replace(/[-_]/g, ' ');
      const date = new Date().toISOString().split('T')[0];
      const frontmatter = `---
title: ${title}
tags: []
date_created: ${date}
always_remember: false
---

`;
      finalContent = frontmatter + content;
    }

    await fs.writeFile(filePath, finalContent, 'utf-8');
    return `Note saved to ${filename}`;
  }

  async saveSession(sessionId: string, messages: any[]): Promise<void> {
    if (!await fs.pathExists(this.sessionHistoryPath)) await fs.mkdirp(this.sessionHistoryPath);
    const filePath = path.join(this.sessionHistoryPath, `${sessionId}.json`);
    await fs.writeJson(filePath, { lastActivityAt: Date.now(), messages }, { spaces: 2 });
  }

  async loadSession(sessionId: string): Promise<any[]> {
    const filePath = path.join(this.sessionHistoryPath, `${sessionId}.json`);
    if (await fs.pathExists(filePath)) {
      const data = await fs.readJson(filePath);

      // Support both new format { lastActivityAt, messages } and legacy array format
      const messages: any[] = Array.isArray(data) ? data : (data.messages ?? []);
      const lastActivityAt: number = Array.isArray(data)
        ? (await fs.stat(filePath)).mtimeMs
        : (data.lastActivityAt ?? Date.now());

      // 10 minutes inactivity rule (600,000 ms)
      if (Date.now() - lastActivityAt > 10 * 60 * 1000) {
        const timestamp = new Date(lastActivityAt).toISOString().replace(/[:.]/g, '-');
        const archivePath = path.join(this.sessionHistoryPath, `${sessionId}_${timestamp}.json`);
        await fs.rename(filePath, archivePath);
        return [];
      }

      return messages;
    }
    return [];
  }
}

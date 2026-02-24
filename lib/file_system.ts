import fs from 'fs-extra';
import path from 'path';

export interface FileContent {
  file: string;
  content: string;
}

export interface FileChunk extends FileContent {
  chunkId: number | null;
}

export interface ScoredFile extends FileContent {
  score: number;
  chunkId?: number | null;
}

export class FileSystem {
  private vaultPath: string;
  private memoryPath: string;
  private skillsPath: string;
  private soulPath: string;

  constructor(vaultPath = './vault', memoryPath = './memory', skillsPath = './skills') {
    this.vaultPath = vaultPath;
    this.memoryPath = memoryPath;
    this.skillsPath = skillsPath;
    this.soulPath = './soul.md';
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

  async readAllNotes(query = ''): Promise<string> {
    const vaultFiles = await this._readDir(this.vaultPath);
    const memoryFiles = await this._readDir(this.memoryPath);
    const skillsFiles = await this._readDir(this.skillsPath);

    const vaultChunks = vaultFiles.flatMap(f => this._chunkFile(f));
    const memoryChunks = memoryFiles.flatMap(f => this._chunkFile(f));
    const skillsChunks = skillsFiles.flatMap(f => this._chunkFile(f));

    // If no query, return all files (backward compatibility)
    if (!query) {
      let context = "--- VAULT NOTES ---\n";
      context += vaultFiles.length > 0 ? vaultFiles.map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') : "No vault notes found.\n";
      context += "\n\n--- MEMORY NOTES ---\n";
      context += memoryFiles.length > 0 ? memoryFiles.map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') : "No memory notes found.\n";
      context += "\n\n--- SKILLS/SCRIPTS ---\n";
      context += skillsFiles.length > 0 ? skillsFiles.map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') : "No skills found.\n";
      return context;
    }

    // Use semantic search for each directory
    const relevantVault = this._semanticSearch(vaultChunks, query);
    const relevantMemory = this._semanticSearch(memoryChunks, query);
    const relevantSkills = this._semanticSearch(skillsChunks, query);

    // Fall back to keyword matching if semantic search returns no results
    const finalVault = relevantVault.length > 0 ? relevantVault : this._keywordMatch(vaultChunks, query);
    const finalMemory = relevantMemory.length > 0 ? relevantMemory : this._keywordMatch(memoryChunks, query);
    const finalSkills = relevantSkills.length > 0 ? relevantSkills : this._keywordMatch(skillsChunks, query);

    // Limit to top results to control context size
    let context = "--- VAULT NOTES ---\n";
    context += finalVault.length > 0 
      ? finalVault.slice(0, 5).map(f => `File: ${f.file}${f.chunkId ? ` (Chunk ${f.chunkId})` : ''}\nContent:\n${f.content}`).join('\n\n')
      : "No relevant vault notes found.\n";
    context += "\n\n--- MEMORY NOTES ---\n";
    context += finalMemory.length > 0 
      ? finalMemory.slice(0, 5).map(f => `File: ${f.file}${f.chunkId ? ` (Chunk ${f.chunkId})` : ''}\nContent:\n${f.content}`).join('\n\n')
      : "No relevant memory notes found.\n";
    context += "\n\n--- SKILLS/SCRIPTS ---\n";
    context += finalSkills.length > 0 
      ? finalSkills.slice(0, 5).map(f => `File: ${f.file}${f.chunkId ? ` (Chunk ${f.chunkId})` : ''}\nContent:\n${f.content}`).join('\n\n')
      : "No relevant skills found.\n";

    return context;
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

  /**
   * Score files based on keyword matching with query
   * @param files - Array of {file, content} objects
   * @param query - Search query
   * @returns - Sorted files with scores
   */
  private _keywordMatch(files: FileChunk[], query: string): ScoredFile[] {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredFiles: (ScoredFile)[] = files.map(({ file, content, chunkId }) => {
      const contentLower = content.toLowerCase();
      let score = 0;

      for (const word of queryWords) {
        // Exact word matches
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length * 2;
        }

        // Partial matches
        if (contentLower.includes(word)) {
          score += 1;
        }
      }

      return { file, content, score, chunkId };
    });

    return scoredFiles.filter(f => f.score > 0).sort((a, b) => b.score - a.score);
  }

  /**
   * Simple TF-IDF based semantic search using cosine similarity
   * @param files - Array of {file, content} objects
   * @param query - Search query
   * @returns - Sorted files with similarity scores
   */
  private _semanticSearch(files: FileChunk[], query: string): ScoredFile[] {
    // Tokenize and count term frequencies
    const tokenize = (text: string): Record<string, number> => {
      return text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
    };

    const queryTerms = tokenize(query);
    const docs = files.map(({ file, content, chunkId }) => ({
      file,
      content,
      chunkId,
      terms: tokenize(content)
    }));

    // Calculate IDF for all terms
    const allTerms = new Set([...Object.keys(queryTerms), ...docs.flatMap(d => Object.keys(d.terms))]);
    const idf: Record<string, number> = {};
    for (const term of allTerms) {
      const docCount = docs.filter(d => d.terms[term]).length;
      idf[term] = Math.log((docs.length + 1) / (docCount + 1)) + 1;
    }

    // Calculate TF-IDF vectors
    const toVector = (terms: Record<string, number>): number[] => {
      const vector: number[] = [];
      for (const term of allTerms) {
        const tf = terms[term] || 0;
        vector.push(tf * idf[term]);
      }
      return vector;
    };

    const queryVector = toVector(queryTerms);
    const docVectors = docs.map(d => ({ ...d, vector: toVector(d.terms) }));

    // Calculate cosine similarity
    const cosineSimilarity = (v1: number[], v2: number[]): number => {
      const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
      const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
      const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
      return mag1 && mag2 ? dotProduct / (mag1 * mag2) : 0;
    };

    const scoredDocs: ScoredFile[] = docVectors.map(({ file, content, chunkId, vector }) => ({
      file,
      content,
      chunkId,
      score: cosineSimilarity(queryVector, vector)
    }));

    return scoredDocs.filter(d => d.score > 0.1).sort((a, b) => b.score - a.score);
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

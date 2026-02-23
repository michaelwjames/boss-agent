import fs from 'fs-extra';
import path from 'path';

export class FileSystem {
  constructor(vaultPath = './vault', memoryPath = './memory', skillsPath = './skills') {
    this.vaultPath = vaultPath;
    this.memoryPath = memoryPath;
    this.skillsPath = skillsPath;
    this.soulPath = './soul.md';
  }

  async loadSoulPrompt() {
    try {
      if (await fs.pathExists(this.soulPath)) {
        return await fs.readFile(this.soulPath, 'utf-8');
      }
    } catch {
      // soul.md is optional
    }
    return '';
  }

  async readAllNotes(query = '') {
    const vaultFiles = await this._readDir(this.vaultPath);
    const memoryFiles = await this._readDir(this.memoryPath);
    const skillsFiles = await this._readDir(this.skillsPath);

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
    const relevantVault = this._semanticSearch(vaultFiles, query);
    const relevantMemory = this._semanticSearch(memoryFiles, query);
    const relevantSkills = this._semanticSearch(skillsFiles, query);

    // Fall back to keyword matching if semantic search returns no results
    const finalVault = relevantVault.length > 0 ? relevantVault : this._keywordMatch(vaultFiles, query);
    const finalMemory = relevantMemory.length > 0 ? relevantMemory : this._keywordMatch(memoryFiles, query);
    const finalSkills = relevantSkills.length > 0 ? relevantSkills : this._keywordMatch(skillsFiles, query);

    // Limit to top 3 results per category to control context size
    let context = "--- VAULT NOTES ---\n";
    context += finalVault.length > 0 
      ? finalVault.slice(0, 3).map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') 
      : "No relevant vault notes found.\n";
    context += "\n\n--- MEMORY NOTES ---\n";
    context += finalMemory.length > 0 
      ? finalMemory.slice(0, 3).map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') 
      : "No relevant memory notes found.\n";
    context += "\n\n--- SKILLS/SCRIPTS ---\n";
    context += finalSkills.length > 0 
      ? finalSkills.slice(0, 3).map(f => `File: ${f.file}\nContent:\n${f.content}`).join('\n\n') 
      : "No relevant skills found.\n";

    return context;
  }

  async _readDir(dirPath) {
    if (!await fs.pathExists(dirPath)) return [];
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const contents = [];
    for (const file of mdFiles) {
      const filePath = path.join(dirPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      contents.push({ file, content });
    }
    return contents;
  }

  /**
   * Score files based on keyword matching with query
   * @param {Array} files - Array of {file, content} objects
   * @param {string} query - Search query
   * @returns {Array} - Sorted files with scores
   */
  _keywordMatch(files, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredFiles = files.map(({ file, content }) => {
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

      return { file, content, score };
    });

    return scoredFiles.filter(f => f.score > 0).sort((a, b) => b.score - a.score);
  }

  /**
   * Simple TF-IDF based semantic search using cosine similarity
   * @param {Array} files - Array of {file, content} objects
   * @param {string} query - Search query
   * @returns {Array} - Sorted files with similarity scores
   */
  _semanticSearch(files, query) {
    // Tokenize and count term frequencies
    const tokenize = (text) => {
      return text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {});
    };

    const queryTerms = tokenize(query);
    const docs = files.map(({ file, content }) => ({
      file,
      content,
      terms: tokenize(content)
    }));

    // Calculate IDF for all terms
    const allTerms = new Set([...Object.keys(queryTerms), ...docs.flatMap(d => Object.keys(d.terms))]);
    const idf = {};
    for (const term of allTerms) {
      const docCount = docs.filter(d => d.terms[term]).length;
      idf[term] = Math.log((docs.length + 1) / (docCount + 1)) + 1;
    }

    // Calculate TF-IDF vectors
    const toVector = (terms) => {
      const vector = [];
      for (const term of allTerms) {
        const tf = terms[term] || 0;
        vector.push(tf * idf[term]);
      }
      return vector;
    };

    const queryVector = toVector(queryTerms);
    const docVectors = docs.map(d => ({ ...d, vector: toVector(d.terms) }));

    // Calculate cosine similarity
    const cosineSimilarity = (v1, v2) => {
      const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
      const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
      const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
      return mag1 && mag2 ? dotProduct / (mag1 * mag2) : 0;
    };

    const scoredDocs = docVectors.map(({ file, content, vector }) => ({
      file,
      content,
      score: cosineSimilarity(queryVector, vector)
    }));

    return scoredDocs.filter(d => d.score > 0.1).sort((a, b) => b.score - a.score);
  }

  async writeNote(filename, content) {
    if (!filename.endsWith('.md')) filename += '.md';
    const filePath = path.join(this.memoryPath, filename);
    await fs.ensureDir(this.memoryPath);
    await fs.writeFile(filePath, content, 'utf-8');
    return `Note saved to ${filename}`;
  }

  async saveSession(sessionId, messages) {
    const sessionDir = './session_history';
    if (!await fs.pathExists(sessionDir)) await fs.mkdirp(sessionDir);
    const filePath = path.join(sessionDir, `${sessionId}.json`);
    await fs.writeJson(filePath, messages, { spaces: 2 });
  }

  async loadSession(sessionId) {
    const filePath = path.join('./session_history', `${sessionId}.json`);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return [];
  }
}

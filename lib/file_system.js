import fs from 'fs-extra';
import path from 'path';

export class FileSystem {
  constructor(vaultPath = './vault', memoryPath = './memory', skillsPath = './skills') {
    this.vaultPath = vaultPath;
    this.memoryPath = memoryPath;
    this.skillsPath = skillsPath;
  }

  async readAllNotes() {
    const vaultFiles = await this._readDir(this.vaultPath);
    const memoryFiles = await this._readDir(this.memoryPath);
    const skillsFiles = await this._readDir(this.skillsPath);
    
    let context = "--- VAULT NOTES ---\n";
    context += vaultFiles.length > 0 ? vaultFiles.join('\n\n') : "No vault notes found.\n";
    context += "\n\n--- MEMORY NOTES ---\n";
    context += memoryFiles.length > 0 ? memoryFiles.join('\n\n') : "No memory notes found.\n";
    context += "\n\n--- SKILLS/SCRIPTS ---\n";
    context += skillsFiles.length > 0 ? skillsFiles.join('\n\n') : "No skills found.\n";
    
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
      contents.push(`File: ${file}\nContent:\n${content}`);
    }
    return contents;
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

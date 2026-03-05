import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FileSystem } from '../../app/lib/data/file_system.js';
import fs from 'fs-extra';
import path from 'path';

describe('FileSystem Session Rotation', () => {
  const testSessionDir = path.join(process.cwd(), 'data', 'test_sessions');
  let fsService: FileSystem;

  beforeEach(async () => {
    await fs.ensureDir(testSessionDir);
    fsService = new FileSystem();
    // Override the session history path for testing
    (fsService as any).sessionHistoryPath = testSessionDir;
  });

  afterEach(async () => {
    await fs.remove(testSessionDir);
  });

  it('should return empty history if session file is older than 10 minutes', async () => {
    const sessionId = 'old-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const oldMessages = [{ role: 'user', content: 'hello' }];

    await fs.writeJson(filePath, oldMessages);

    // Set mtime to 11 minutes ago
    const oldTime = new Date(Date.now() - 11 * 60 * 1000);
    await fs.utimes(filePath, oldTime, oldTime);

    const history = await fsService.loadSession(sessionId);
    expect(history).toEqual([]);

    // Check if archived file exists
    const files = await fs.readdir(testSessionDir);
    const archivedFile = files.find(f => f.startsWith(`${sessionId}_`) && f.endsWith('.json'));
    expect(archivedFile).toBeDefined();
  });

  it('should return history if session file is recent', async () => {
    const sessionId = 'new-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const messages = [{ role: 'user', content: 'hello' }];

    await fs.writeJson(filePath, messages);

    // Set mtime to 5 minutes ago
    const recentTime = new Date(Date.now() - 5 * 60 * 1000);
    await fs.utimes(filePath, recentTime, recentTime);

    const history = await fsService.loadSession(sessionId);
    expect(history).toEqual(messages);
  });
});

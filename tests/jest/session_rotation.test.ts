import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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

  it('should return empty history if lastActivityAt is older than 10 minutes', async () => {
    const sessionId = 'old-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const oldMessages = [{ role: 'user', content: 'hello' }];
    const oldTime = Date.now() - 11 * 60 * 1000;

    await fs.writeJson(filePath, { lastActivityAt: oldTime, messages: oldMessages });

    const history = await fsService.loadSession(sessionId);
    expect(history).toEqual([]);

    // Check if archived file exists
    const files = await fs.readdir(testSessionDir);
    const archivedFile = files.find(f => f.startsWith(`${sessionId}_`) && f.endsWith('.json'));
    expect(archivedFile).toBeDefined();
  });

  it('should return history if lastActivityAt is recent', async () => {
    const sessionId = 'new-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const messages = [{ role: 'user', content: 'hello' }];
    const recentTime = Date.now() - 5 * 60 * 1000;

    await fs.writeJson(filePath, { lastActivityAt: recentTime, messages });

    const history = await fsService.loadSession(sessionId);
    expect(history).toEqual(messages);
  });

  it('should handle legacy array format using mtime for rotation', async () => {
    const sessionId = 'legacy-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const oldMessages = [{ role: 'user', content: 'legacy' }];

    await fs.writeJson(filePath, oldMessages);

    // Set mtime to 11 minutes ago to simulate stale legacy session
    const oldTime = new Date(Date.now() - 11 * 60 * 1000);
    await fs.utimes(filePath, oldTime, oldTime);

    const history = await fsService.loadSession(sessionId);
    expect(history).toEqual([]);

    const files = await fs.readdir(testSessionDir);
    const archivedFile = files.find(f => f.startsWith(`${sessionId}_`) && f.endsWith('.json'));
    expect(archivedFile).toBeDefined();
  });

  it('should persist lastActivityAt when saving a session', async () => {
    const sessionId = 'save-session';
    const filePath = path.join(testSessionDir, `${sessionId}.json`);
    const messages = [{ role: 'user', content: 'hello' }];

    const before = Date.now();
    await fsService.saveSession(sessionId, messages);
    const after = Date.now();

    const data = await fs.readJson(filePath);
    expect(Array.isArray(data)).toBe(false);
    expect(data.messages).toEqual(messages);
    expect(data.lastActivityAt).toBeGreaterThanOrEqual(before);
    expect(data.lastActivityAt).toBeLessThanOrEqual(after);
  });
});

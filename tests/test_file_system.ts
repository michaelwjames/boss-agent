import { FileSystem } from '../dist/lib/data/file_system.js';
import fs from 'fs-extra';
import assert from 'assert';

async function testFileSystem() {
  const fsUtil = new FileSystem('./test_vault', './test_memory', './test_skills');
  
  // Setup
  await fs.ensureDir('./test_vault');
  await fs.ensureDir('./test_memory');
  await fs.ensureDir('./test_skills');
  await fs.writeFile('./test_vault/test.md', 'Vault content');
  
  // Test getFileSystemIndex (replaces readAllNotes)
  const context = await fsUtil.getFileSystemIndex();
  console.log('Context:\n', context);
  assert(context.includes('test.md'));
  
  // Test writeNote
  await fsUtil.writeNote('new_note', 'Memory content');
  const memoryContent = await fs.readFile('./test_memory/new_note.md', 'utf-8');
  assert(memoryContent === 'Memory content');
  
  // Test save/load session
  await fsUtil.saveSession('test_session', [{ role: 'user', content: 'hello' }]);
  const history = await fsUtil.loadSession('test_session');
  assert(history[0].content === 'hello');
  
  // Cleanup
  await fs.remove('./test_vault');
  await fs.remove('./test_memory');
  await fs.remove('./test_skills');
  await fs.remove('./session_history/test_session.json');
  
  console.log('FileSystem tests passed!');
}

testFileSystem().catch(err => {
  console.error('FileSystem tests failed:', err);
  process.exit(1);
});

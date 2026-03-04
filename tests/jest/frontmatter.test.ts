import { FileSystem } from '../../app/lib/data/file_system.js';
import fs from 'fs-extra';
import path from 'path';

describe('FileSystem YAML Frontmatter', () => {
  let fileSystem: FileSystem;
  const testDir = path.resolve('./data/test_memory');

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    fileSystem = new FileSystem(undefined, testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('prepends YAML frontmatter if missing', async () => {
    const filename = 'test_note';
    const content = 'This is a test note.';
    await fileSystem.writeNote(filename, content);

    const savedContent = await fs.readFile(path.join(testDir, 'test_note.md'), 'utf-8');
    expect(savedContent).toContain('---');
    expect(savedContent).toContain('title: test note');
    expect(savedContent).toContain('date_created:');
    expect(savedContent).toContain(content);
  });

  test('does not prepend if frontmatter already exists', async () => {
    const filename = 'existing_frontmatter';
    const content = '---\ntitle: Existing Title\n---\nBody content';
    await fileSystem.writeNote(filename, content);

    const savedContent = await fs.readFile(path.join(testDir, 'existing_frontmatter.md'), 'utf-8');
    const matches = savedContent.match(/---/g);
    expect(matches?.length).toBe(2);
    expect(savedContent).toContain('title: Existing Title');
  });
});

import { FileSystem } from '../../lib/file_system.js';

describe('FileSystem Chunking', () => {
  let fs;

  beforeEach(() => {
    fs = new FileSystem();
  });

  test('chunks large markdown files', () => {
    const largeContent = '# Header 1\n' + 'a'.repeat(2500) + '\n# Header 2\n' + 'b'.repeat(2500);
    const chunks = fs._chunkFile({ file: 'test.md', content: largeContent });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].file).toBe('test.md');
    expect(chunks[0].chunkId).toBe(1);
    expect(chunks[1].chunkId).toBe(2);
  });

  test('does not chunk small files', () => {
    const smallContent = 'Short content';
    const chunks = fs._chunkFile({ file: 'test.md', content: smallContent });

    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkId).toBeNull();
  });

  test('chunks at headers when content is large enough', () => {
    const content = '# Part 1\n' + 'x'.repeat(1500) + '\n# Part 2\n' + 'y'.repeat(1500);
    const chunks = fs._chunkFile({ file: 'test.md', content: content });

    expect(chunks.length).toBeGreaterThan(1);
    const hasPart2 = chunks.some(c => c.content.includes('# Part 2'));
    expect(hasPart2).toBe(true);
  });
});

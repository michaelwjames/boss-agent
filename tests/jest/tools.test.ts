import { jest } from '@jest/globals';
import { ToolRegistry } from '../../lib/tools.js';

describe('ToolRegistry', () => {
  let nomenclatureMock: any;
  let tools: ToolRegistry;

  beforeEach(() => {
    nomenclatureMock = {
      resolveRepoName: jest.fn().mockReturnValue({ exact: { name: 'owner/repo' }, candidates: [] })
    };
    tools = new ToolRegistry(nomenclatureMock);
    // Mock make.run to avoid actual execution
    (tools as any).make.run = jest.fn(() => Promise.resolve({ stdout: 'success', stderr: '', exitCode: 0 }));
  });

  test('run_make tool executes successfully', async () => {
    const result = await tools.execute('run_make', { target: 'status', args: {} });
    expect((tools as any).make.run).toHaveBeenCalledWith('status', {});
    expect(result).toContain('STDOUT: success');
  });

  test('write_note tool executes successfully', async () => {
    // Mock fs.writeNote
    (tools as any).fs.writeNote = jest.fn(() => Promise.resolve('Note saved'));
    const result = await tools.execute('write_note', { filename: 'test.md', content: 'test' });
    expect((tools as any).fs.writeNote).toHaveBeenCalledWith('test.md', 'test');
    expect(result).toBe('Note saved');
  });
});

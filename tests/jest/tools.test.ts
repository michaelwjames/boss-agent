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

  test('jules tool uses nomenclature to resolve repo', async () => {
    await tools.execute('jules', { action: 'create', repo: 'my-fuzzy-repo', prompt: 'test' });

    expect(nomenclatureMock.resolveRepoName).toHaveBeenCalledWith('my-fuzzy-repo');
    expect((tools as any).make.run).toHaveBeenCalledWith('jules', expect.objectContaining({
      A: expect.stringContaining('--repo owner/repo')
    }));
  });

  test('jules tool constructs correct command arguments', async () => {
    await tools.execute('jules', {
      action: 'send-message',
      sessionId: '123',
      prompt: 'Hello "World"'
    });

    expect((tools as any).make.run).toHaveBeenCalledWith('jules', expect.objectContaining({
      A: expect.stringContaining('send-message --plain')
    }));
    expect((tools as any).make.run).toHaveBeenCalledWith('jules', expect.objectContaining({
      A: expect.stringContaining('--session-id 123')
    }));
    expect((tools as any).make.run).toHaveBeenCalledWith('jules', expect.objectContaining({
      A: expect.stringContaining('--message "Hello \\"World\\""')
    }));
  });
});

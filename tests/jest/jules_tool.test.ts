import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { JulesTool } from '../../app/lib/tools/jules.js';

describe('JulesTool', () => {
  let mockMake: any;
  let julesTool: JulesTool;
  let mockContext: any;

  beforeEach(() => {
    mockMake = {
      run: jest.fn().mockResolvedValue({
        stdout: 'Success Output',
        stderr: '',
        exitCode: 0
      })
    };
    julesTool = new JulesTool(mockMake);
    mockContext = {
      sessionId: 'test-session',
      send: jest.fn().mockResolvedValue({ id: 'msg-1' })
    };
  });

  it('should send output to discord and return truncated version to LLM', async () => {
    const args = { action: 'list-sessions' };
    const result = await julesTool.execute(args, mockContext);
    const parsed = JSON.parse(result);

    expect(mockMake.run).toHaveBeenCalledWith('jules-list-sessions', { SIZE: '10' });
    expect(mockContext.send).toHaveBeenCalledWith('Success Output');
    expect(parsed.stdout).toBe('Success Output');
    expect(parsed._fullStdout).toBe('Success Output');
  });

  it('should truncate output for LLM if too long', async () => {
    const longOutput = 'A'.repeat(600);
    mockMake.run.mockResolvedValue({
      stdout: longOutput,
      stderr: '',
      exitCode: 0
    });

    const result = await julesTool.execute({ action: 'list-sessions' }, mockContext);
    const parsed = JSON.parse(result);

    expect(parsed.stdout).toContain('... (full output displayed in channel)');
    expect(parsed.stdout.length).toBeLessThan(600);
    expect(parsed._fullStdout).toBe(longOutput);
    expect(mockContext.send).toHaveBeenCalledWith(longOutput);
  });
});

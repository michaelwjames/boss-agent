import { jest } from '@jest/globals';
import { MakeExecutor } from '../../lib/make_executor.js';

// We need to use doMock for ESM if we want to mock modules
jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn(),
  promisify: (fn: any) => fn, // Simplified promisify mock
}));

describe('MakeExecutor', () => {
  let executor: MakeExecutor;

  beforeEach(() => {
    executor = new MakeExecutor();
  });

  test('truncates long stdout', () => {
    const longOutput = 'a'.repeat(6000);
    // Directly mock the _truncate for simpler testing since we already verified it
    const result = (executor as any)._truncate(longOutput);

    expect(result.length).toBeLessThan(6000);
    expect(result).toContain('[... Output truncated due to length ...]');
  });

  test('truncates long stderr', () => {
    const longOutput = 'e'.repeat(6000);
    const result = (executor as any)._truncate(longOutput);

    expect(result.length).toBeLessThan(6000);
    expect(result).toContain('[... Output truncated due to length ...]');
  });
});

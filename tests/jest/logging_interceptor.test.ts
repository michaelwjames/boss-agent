import { jest } from '@jest/globals';

// Mock the logger BEFORE importing the interceptor
jest.unstable_mockModule('../../app/lib/utils/logger.js', () => ({
  log: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

const { LoggingInterceptor } = await import('../../app/lib/interceptors/logging.js');
const { log } = await import('../../app/lib/utils/logger.js');

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    (log as any).mockClear();
  });

  test('preExecute logs action start and args', async () => {
    const args = { key: 'value' };
    await interceptor.preExecute('test_tool', args);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[ACTION_START] Tool: test_tool'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[ACTION_ARGS]'), JSON.stringify(args, null, 2));
  });

  test('postExecute logs action end and result', async () => {
    const result = 'execution result';
    await interceptor.postExecute('test_tool', { key: 'value' }, result);

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[ACTION_END] Tool: test_tool'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[ACTION_RESULT]'), result);
  });
});

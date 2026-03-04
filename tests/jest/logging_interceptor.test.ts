import { jest } from '@jest/globals';
import { LoggingInterceptor } from '../../app/lib/interceptors/logging.js';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let consoleSpy: any;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('preExecute logs action start and args', async () => {
    const args = { key: 'value' };
    await interceptor.preExecute('test_tool', args);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_START] Tool: test_tool'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_ARGS]'), JSON.stringify(args, null, 2));
  });

  test('postExecute logs action end and result', async () => {
    const result = 'execution result';
    await interceptor.postExecute('test_tool', { key: 'value' }, result);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_END] Tool: test_tool'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_RESULT]'), result);
  });
});

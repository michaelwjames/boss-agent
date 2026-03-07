import { jest } from '@jest/globals';
import { LoggingInterceptor } from '../../app/lib/interceptors/logging.js';
import { Logger } from '../../app/lib/utils/logger.js';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: any;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    const logger = Logger.getInstance();
    logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('preExecute logs action start and args', async () => {
    const args = { key: 'value' };
    await interceptor.preExecute('test_tool', args);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_START] Tool: test_tool'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_ARGS]'), JSON.stringify(args, null, 2));
  });

  test('postExecute logs action end and result', async () => {
    const result = 'execution result';
    await interceptor.postExecute('test_tool', { key: 'value' }, result);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_END] Tool: test_tool'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[ACTION_RESULT]'), result);
  });
});

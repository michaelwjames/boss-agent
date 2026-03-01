import { jest } from '@jest/globals';
import { MakeExecutor } from '../../app/lib/executors/make_executor.js';
import { TokenTracker } from '../../app/lib/analytics/token_tracker.js';
import { TokenTruncationInterceptor } from '../../app/lib/interceptors/token_truncation.js';

describe('MakeExecutor and TokenTruncationInterceptor', () => {
  let executor: MakeExecutor;
  let tokenTracker: TokenTracker;
  let interceptor: TokenTruncationInterceptor;

  beforeEach(() => {
    executor = new MakeExecutor();
    tokenTracker = new TokenTracker();
    interceptor = new TokenTruncationInterceptor(tokenTracker, 100); // Low threshold for testing
  });

  test('TokenTruncationInterceptor truncates long output', async () => {
    const longOutput = 'a '.repeat(200); // 200 tokens approximately
    const result = await interceptor.postExecute('test_tool', {}, longOutput);

    expect(tokenTracker.countTokens(result)).toBeGreaterThan(0);
    expect(result).toContain('[Output truncated due to token limits');
  });

  test('TokenTruncationInterceptor does not truncate short output', async () => {
    const shortOutput = 'short output';
    const result = await interceptor.postExecute('test_tool', {}, shortOutput);

    expect(result).toBe(shortOutput);
  });
});

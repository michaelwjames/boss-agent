import { ToolInterceptor } from './base.js';

/**
 * Aggressive logging interceptor that records all tool actions to the console.
 */
export class LoggingInterceptor implements ToolInterceptor {
  async preExecute(toolName: string, args: any): Promise<any> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ACTION_START] Tool: ${toolName}`);
    console.log(`[${timestamp}] [ACTION_ARGS] `, JSON.stringify(args, null, 2));
    return args;
  }

  async postExecute(toolName: string, args: any, result: string): Promise<string> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ACTION_END] Tool: ${toolName}`);
    // Aggressive logging includes the full result
    console.log(`[${timestamp}] [ACTION_RESULT] `, result);
    return result;
  }
}

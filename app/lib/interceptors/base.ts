/**
 * Base interface for tool execution interceptors.
 * Interceptors can modify arguments before execution or process results after.
 */
export interface ToolInterceptor {
  /**
   * Called before tool execution.
   * Can be used for logging, validation, or argument modification.
   * @returns Possibly modified arguments
   */
  preExecute?(toolName: string, args: any): Promise<any>;

  /**
   * Called after tool execution.
   * Can be used for post-processing results, like truncation.
   * @returns Possibly modified result string
   */
  postExecute?(toolName: string, args: any, result: string): Promise<string>;
}

/**
 * Base interface for all tool implementations.
 * This pattern allows for each tool to be encapsulated in its own class.
 */
export interface Tool {
  /**
   * The primary entry point for tool logic.
   * @param args - Tool-specific arguments passed by the LLM
   * @returns - A string result to return to the LLM
   */
  execute(args: any): Promise<string>;
}

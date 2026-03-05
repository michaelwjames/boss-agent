export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * Context provided to tools during execution.
 * Allows tools to interact with the environment (e.g., sending messages).
 */
export interface ToolContext {
  sessionId: string;
  send: (content: string) => Promise<any>;
}

/**
 * Base interface for all tool implementations.
 * Each tool co-locates its LLM schema definition with its implementation.
 */
export interface Tool {
  /** OpenAI-compatible tool schema sent to the LLM. */
  definition: ToolDefinition;
  /**
   * The primary entry point for tool logic.
   * @param args - Tool-specific arguments passed by the LLM
   * @param context - Optional context for interacting with the environment
   * @returns - A string result to return to the LLM
   */
  execute(args: any, context?: ToolContext): Promise<string>;
}

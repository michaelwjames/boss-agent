/**
 * Base LLM provider interface.
 * All providers (Groq, Anthropic, OpenAI, etc.) must extend this class.
 */
export abstract class LLMProvider {
  /**
   * Send a chat completion request.
   * @param messages - Chat messages array
   * @param tools - Tool definitions (OpenAI-compatible format)
   * @returns - The assistant message object (with .content and optionally .tool_calls)
   */
  abstract chat(messages: any[], tools?: any[]): Promise<any>;

  /**
   * Transcribe an audio file to text.
   * @param filePath - Path to the audio file
   * @returns - Transcribed text
   */
  abstract transcribe(filePath: string): Promise<string>;
}

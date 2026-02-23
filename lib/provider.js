/**
 * Base LLM provider interface.
 * All providers (Groq, Anthropic, OpenAI, etc.) must extend this class.
 */
export class LLMProvider {
  /**
   * Send a chat completion request.
   * @param {Array} messages - Chat messages array
   * @param {Array} tools - Tool definitions (OpenAI-compatible format)
   * @returns {Object} - The assistant message object (with .content and optionally .tool_calls)
   */
  async chat(messages, tools = []) {
    throw new Error('chat() not implemented');
  }

  /**
   * Transcribe an audio file to text.
   * @param {string} filePath - Path to the audio file
   * @returns {string} - Transcribed text
   */
  async transcribe(filePath) {
    throw new Error('transcribe() not implemented');
  }
}

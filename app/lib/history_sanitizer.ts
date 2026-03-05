/**
 * Sanitizes tool results before they are added to the session history.
 * For Jules tool, we restore the full stdout from _fullStdout so the agent
 * has context when reading the session history later.
 */
export function sanitizeHistory(messages: any[]): any[] {
  return messages.map(msg => {
    if (msg.role === 'tool' && msg.name === 'jules') {
      try {
        const content = JSON.parse(msg.content);
        if (content._fullStdout) {
          const { _fullStdout, ...rest } = content;
          // Restore full stdout for history
          return { ...msg, content: JSON.stringify({ ...rest, stdout: _fullStdout }) };
        }
      } catch (e) {
        // Not JSON or other error, return as is
      }
    }
    return msg;
  });
}

/**
 * Strips internal fields from tool results before they are passed back to the LLM.
 * This is used to keep the LLM's immediate context window clean.
 */
export function stripInternalFields(result: string): string {
  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === 'object' && parsed._fullStdout !== undefined) {
      const { _fullStdout, ...rest } = parsed;
      return JSON.stringify(rest);
    }
  } catch (e) {
    // Not JSON, return original
  }
  return result;
}

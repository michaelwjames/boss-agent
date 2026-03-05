/**
 * Registry of tool names that use the _fullStdout pattern.
 * Add new high-volume tools here when they adopt the display-and-truncate pattern.
 */
const FULL_STDOUT_TOOLS = new Set<string>(['jules']);

export function registerFullStdoutTool(toolName: string): void {
  FULL_STDOUT_TOOLS.add(toolName);
}

/**
 * Sanitizes tool results before they are added to the session history.
 * For tools in FULL_STDOUT_TOOLS, restores the full stdout from _fullStdout
 * so the agent has full context when reading session history later.
 */
export function sanitizeHistory(messages: any[]): any[] {
  return messages.map(msg => {
    if (msg.role === 'tool' && FULL_STDOUT_TOOLS.has(msg.name)) {
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

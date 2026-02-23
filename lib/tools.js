import { MakeExecutor } from './make_executor.js';
import { FileSystem } from './file_system.js';

/**
 * Tool registry — single source of truth for all tool definitions and executors.
 */
export class ToolRegistry {
  constructor() {
    this.make = new MakeExecutor();
    this.fs = new FileSystem();
  }

  /**
   * Returns OpenAI-compatible tool definitions for the LLM.
   */
  getDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'run_make',
          description: 'Execute a predefined make target. Only targets defined in the root Makefile are allowed. You cannot run arbitrary shell commands. Available targets: status, test, list-files (DIR=), read-file (FILE=), read-skill (S=), git-status, git-diff, git-log, git-summary, pr-list, pr-diff (PR_NUMBER=), pr-view (PR_NUMBER=), pr-merge (PR_NUMBER=), pr-close (PR_NUMBER=), remind (DELAY= MESSAGE= DISCORD_WEBHOOK_URL=), safe-gemini (QUERY=), linear-task (TITLE= DESCRIPTION=), vercel-logs, jules-help, jules (A=args).',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'The make target to run (e.g., "git-status", "pr-list", "pr-diff").',
              },
              args: {
                type: 'object',
                description: 'Key-value arguments passed to make (e.g., {"PR_NUMBER": "42"}).',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['target'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'write_note',
          description: 'Save a new note to the memory directory as a Markdown file.',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'The name of the file (e.g., report.md).',
              },
              content: {
                type: 'string',
                description: 'The content of the note in Markdown format.',
              },
            },
            required: ['filename', 'content'],
          },
        },
      },
    ];
  }

  /**
   * Execute a tool call by name.
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments
   * @returns {string} - Tool execution result
   */
  async execute(name, args) {
    switch (name) {
      case 'run_make': {
        const result = await this.make.run(args.target, args.args);
        return `STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}\nExit Code: ${result.exitCode}`;
      }
      case 'write_note': {
        return await this.fs.writeNote(args.filename, args.content);
      }
      default:
        return `Error: Unknown tool "${name}"`;
    }
  }
}

import { MakeExecutor } from './make_executor.js';
import { FileSystem } from './file_system.js';

/**
 * Tool registry — single source of truth for all tool definitions and executors.
 */
export class ToolRegistry {
  constructor(nomenclature) {
    this.make = new MakeExecutor();
    this.fs = new FileSystem();
    this.nomenclature = nomenclature;
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
          description: 'Execute a predefined make target. Only targets defined in the root Makefile are allowed. You cannot run arbitrary shell commands. Available targets: status, test, list-files (DIR=), read-file (FILE=), read-skill (S=), git-status, git-diff, git-log, git-summary, pr-list, pr-diff (PR_NUMBER=), pr-view (PR_NUMBER=), pr-merge (PR_NUMBER=), pr-close (PR_NUMBER=), remind (DELAY= MESSAGE= DISCORD_WEBHOOK_URL=), safe-gemini (QUERY=), linear-task (TITLE= DESCRIPTION=), vercel-logs.',
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
          name: 'jules',
          description: 'Interact with the Jules AI agent for complex coding tasks, PR reviews, or repository-wide changes.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['create', 'list-sessions', 'get-session', 'send-message', 'approve-plan', 'list-sources'],
                description: 'The action to perform with Jules.',
              },
              prompt: {
                type: 'string',
                description: 'The instruction or message for Jules (used with create, send-message).',
              },
              repo: {
                type: 'string',
                description: 'The GitHub repository name (owner/repo) for the session.',
              },
              sessionId: {
                type: 'string',
                description: 'The ID of an existing Jules session.',
              },
              extraArgs: {
                type: 'string',
                description: 'Any additional flags or arguments for the jules client.',
              }
            },
            required: ['action'],
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
      case 'jules': {
        let commandArgs = `${args.action} --plain`;
        if (args.prompt) commandArgs += ` --prompt "${args.prompt.replace(/"/g, '\\"')}"`;

        let repo = args.repo;
        if (repo && this.nomenclature) {
          const { exact } = this.nomenclature.resolveRepoName(repo);
          if (exact) {
            console.log(`[NOMENCLATURE] Automatically corrected repo ${repo} to ${exact.name}`);
            repo = exact.name;
          }
        }
        if (repo) commandArgs += ` --repo ${repo}`;

        if (args.sessionId) commandArgs += ` --session-id ${args.sessionId}`;
        if (args.action === 'send-message' && args.prompt) commandArgs += ` --message "${args.prompt.replace(/"/g, '\\"')}"`;
        if (args.extraArgs) commandArgs += ` ${args.extraArgs}`;

        const result = await this.make.run('jules', { A: commandArgs });
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

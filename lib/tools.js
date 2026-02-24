import { MakeExecutor } from './make_executor.js';
import { FileSystem } from './file_system.js';
import toolsDefinitions from './tools.json' with { type: 'json' };

/**
 * Tool registry — single source of truth for all tool definitions and executors.
 */
export class ToolRegistry {
  constructor(nomenclature) {
    this.make = new MakeExecutor();
    this.fs = new FileSystem();
    this.nomenclature = nomenclature;
    this.definitions = structuredClone(toolsDefinitions);
    this._refreshMakeDescription();
  }

  /**
   * Refresh the run_make tool description with the latest targets from the Makefile.
   */
  _refreshMakeDescription() {
    const runMakeTool = this.definitions.find(d => d.function.name === 'run_make');
    if (runMakeTool) {
      const makeHelp = this.make.getHelp();
      // Replace the placeholder or update the description
      const baseDescription = "Execute a predefined make target. Only targets defined in the root Makefile are allowed. You cannot run arbitrary shell commands. ";
      runMakeTool.function.description = baseDescription + "Available targets: " + makeHelp;
    }
  }

  /**
   * Returns OpenAI-compatible tool definitions for the LLM.
   */
  getDefinitions() {
    return this.definitions;
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

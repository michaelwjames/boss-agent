import { MakeExecutor } from './make_executor.js';
import { FileSystem } from './file_system.js';
import { Nomenclature } from './nomenclature.js';
import { TokenTracker } from './token_tracker.js';
import toolsDefinitions from './tools.json' with { type: 'json' };

/**
 * Tool registry — single source of truth for all tool definitions and executors.
 */
export class ToolRegistry {
  private make: MakeExecutor;
  private fs: FileSystem;
  private nomenclature?: Nomenclature;
  private tokenTracker?: TokenTracker;
  private definitions: any[];

  constructor(fs: FileSystem, nomenclature?: Nomenclature, tokenTracker?: TokenTracker) {
    this.make = new MakeExecutor();
    this.fs = fs;
    this.nomenclature = nomenclature;
    this.tokenTracker = tokenTracker;
    this.definitions = structuredClone(toolsDefinitions as any[]);
    this._refreshMakeDescription();
  }

  /**
   * Refresh the run_make tool description with the latest targets from the Makefile.
   */
  private _refreshMakeDescription(): void {
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
  getDefinitions(): any[] {
    return this.definitions;
  }

  /**
   * Execute a tool call by name.
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns - Tool execution result
   */
  async execute(name: string, args: any): Promise<string> {
    switch (name) {
      case 'run_make': {
        const result = await this.make.run(args.target, args.args);
        return `STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}\nExit Code: ${result.exitCode}`;
      }
      case 'write_note': {
        return await this.fs.writeNote(args.filename, args.content);
      }
      case 'get_context_stats': {
        if (!this.tokenTracker) {
          return 'Error: Token tracker not initialized';
        }
        const rateLimitStats = this.tokenTracker.getRateLimitStats(args.model || 'meta-llama/llama-4-scout-17b-16e-instruct');
        return `Current rate limit stats for ${rateLimitStats.model}:\n${JSON.stringify(rateLimitStats, null, 2)}`;
      }
      case 'jules': {
        // Direct mapping to the new make targets based on action
        const targetName = `jules-${args.action}`;
        
        // Pass relevant arguments to the make target
        const makeArgs: Record<string, string> = {};
        if (args.sessionId) makeArgs.ID = args.sessionId;
        if (args.prompt) makeArgs.MESSAGE = args.prompt;
        if (args.repo) makeArgs.REPO = args.repo;
        
        const result = await this.make.run(targetName, makeArgs);
        return `STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}\nExit Code: ${result.exitCode}`;
      }
      default: {
        // Try to run as a make target (for dynamically created skills)
        // First, reload allowed targets to catch any new ones
        this.make.reload();
        const result = await this.make.run(name, args);
        if (result.stderr && result.stderr.includes('is not allowed')) {
          return `Error: Unknown tool "${name}"`;
        }
        return `STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}\nExit Code: ${result.exitCode}`;
      }
    }
  }
}

import { MakeExecutor } from './executors/make_executor.js';
import { FileSystem } from './data/file_system.js';
import { TokenTracker } from './analytics/token_tracker.js';
import { ToolInterceptor } from './interceptors/base.js';
import { Tool, ToolDefinition, ToolContext } from './tools/base.js';
import { RunMakeTool } from './tools/run_make.js';
import { WriteNoteTool } from './tools/write_note.js';
import { ReadMemoryTool } from './tools/read_memory.js';
import { GetContextStatsTool } from './tools/get_context_stats.js';
import { JulesTool } from './tools/jules.js';
import { DisplayLargeOutputTool } from './tools/display_large_output.js';

// Definitions for pure make-target tools that have no Tool class.
// These are executed via the dynamic make target fallback in execute().
const MAKE_TARGET_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_boss_skills',
      description: 'Create a new skill for the Boss Agent by generating stubs and registering it in the system.',
      parameters: {
        type: 'object',
        properties: {
          NAME: {
            type: 'string',
            description: "The name of the new skill (e.g., 'pdf-summarizer')",
          },
          PROMPT: {
            type: 'string',
            description: "The requirements and description of the skill's functionality",
          },
        },
        required: ['NAME', 'PROMPT'],
      },
    },
  },
];

/**
 * Tool registry — single source of truth for all tool definitions and executors.
 * To add a new tool: create its class in app/lib/tools/, then call register() below.
 */
export class ToolRegistry {
  private make: MakeExecutor;
  private fs: FileSystem;
  private tokenTracker?: TokenTracker;
  private definitions: ToolDefinition[] = [...MAKE_TARGET_DEFINITIONS];
  private interceptors: ToolInterceptor[] = [];
  private tools: Map<string, Tool> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(fs: FileSystem, _nomenclature?: unknown, tokenTracker?: TokenTracker) {
    this.make = new MakeExecutor();
    this.fs = fs;
    this.tokenTracker = tokenTracker;

    this._initializeTools();
  }

  /**
   * Register a tool — adds its definition and executor in one call.
   */
  private register(tool: Tool): void {
    this.definitions.push(tool.definition);
    this.tools.set(tool.definition.function.name, tool);
  }

  /**
   * Initialize all tools. To add a new tool, create its class and add one register() call here.
   */
  private _initializeTools(): void {
    const runMakeTool = new RunMakeTool(this.make);
    // Append the live list of available make targets to run_make's description.
    runMakeTool.definition.function.description +=
      ' Available targets: ' + this.make.getHelp();
    this.register(runMakeTool);

    this.register(new WriteNoteTool(this.fs));
    this.register(new ReadMemoryTool(this.fs));
    this.register(new JulesTool(this.make));
    this.register(new DisplayLargeOutputTool(this.fs));

    if (this.tokenTracker) {
      this.register(new GetContextStatsTool(this.tokenTracker));
    }
  }

  /**
   * Register a tool interceptor.
   */
  addInterceptor(interceptor: ToolInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Returns OpenAI-compatible tool definitions for the LLM.
   */
  getDefinitions(): ToolDefinition[] {
    return this.definitions;
  }

  /**
   * Execute a tool call by name.
   * @param name - Tool name
   * @param args - Tool arguments
   * @param context - Optional context for interacting with the environment
   * @returns - Tool execution result
   */
  async execute(name: string, args: any, context?: ToolContext): Promise<string> {
    let currentArgs = args;

    // Run pre-execute interceptors
    for (const interceptor of this.interceptors) {
      if (interceptor.preExecute) {
        currentArgs = await interceptor.preExecute(name, currentArgs);
      }
    }

    let result = '';

    // Strategy: Look up the tool in the map, otherwise fallback to dynamic make target
    const tool = this.tools.get(name);
    if (tool) {
      result = await tool.execute(currentArgs, context);
    } else {
      // Try to run as a make target (for dynamically created skills)
      // First, reload allowed targets to catch any new ones
      this.make.reload();
      const cmdResult = await this.make.run(name, currentArgs);
      if (cmdResult.stderr && cmdResult.stderr.includes('is not allowed')) {
        result = `Error: Unknown tool "${name}"`;
      } else {
        result = `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
      }
    }

    // Run post-execute interceptors
    for (const interceptor of this.interceptors) {
      if (interceptor.postExecute) {
        result = await interceptor.postExecute(name, currentArgs, result);
      }
    }

    return result;
  }
}

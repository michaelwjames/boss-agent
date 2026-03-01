import { MakeExecutor } from './executors/make_executor.js';
import { RunMakeTool } from './tools/run_make.js';
import { WriteNoteTool } from './tools/write_note.js';
import { ReadMemoryTool } from './tools/read_memory.js';
import { GetContextStatsTool } from './tools/get_context_stats.js';
import { JulesTool } from './tools/jules.js';
import toolsDefinitions from './config/tools.json' with { type: 'json' };
/**
 * Tool registry — single source of truth for all tool definitions and executors.
 */
export class ToolRegistry {
    make;
    fs;
    nomenclature;
    tokenTracker;
    definitions;
    interceptors = [];
    tools = new Map();
    constructor(fs, nomenclature, tokenTracker) {
        this.make = new MakeExecutor();
        this.fs = fs;
        this.nomenclature = nomenclature;
        this.tokenTracker = tokenTracker;
        this.definitions = structuredClone(toolsDefinitions);
        this._initializeTools();
        this._refreshMakeDescription();
    }
    /**
     * Initialize the tool implementations.
     */
    _initializeTools() {
        this.tools.set('run_make', new RunMakeTool(this.make));
        this.tools.set('write_note', new WriteNoteTool(this.fs));
        this.tools.set('read_memory', new ReadMemoryTool(this.fs));
        this.tools.set('jules', new JulesTool(this.make));
        if (this.tokenTracker) {
            this.tools.set('get_context_stats', new GetContextStatsTool(this.tokenTracker));
        }
    }
    /**
     * Register a tool interceptor.
     */
    addInterceptor(interceptor) {
        this.interceptors.push(interceptor);
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
     * @param name - Tool name
     * @param args - Tool arguments
     * @returns - Tool execution result
     */
    async execute(name, args) {
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
            result = await tool.execute(currentArgs);
        }
        else {
            // Try to run as a make target (for dynamically created skills)
            // First, reload allowed targets to catch any new ones
            this.make.reload();
            const cmdResult = await this.make.run(name, currentArgs);
            if (cmdResult.stderr && cmdResult.stderr.includes('is not allowed')) {
                result = `Error: Unknown tool "${name}"`;
            }
            else {
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

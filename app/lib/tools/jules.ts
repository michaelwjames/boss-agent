import { Tool } from './base.js';
import { MakeExecutor } from '../executors/make_executor.js';

/**
 * Tool to interact with the Jules AI agent.
 */
export class JulesTool implements Tool {
  private make: MakeExecutor;

  constructor(make: MakeExecutor) {
    this.make = make;
  }

  async execute(args: any): Promise<string> {
    const targetName = `jules-${args.action}`;
    
    // Pass relevant arguments to the make target
    const makeArgs: Record<string, string> = {};
    if (args.sessionId) makeArgs.ID = args.sessionId;
    if (args.action === 'create' && args.prompt) makeArgs.PROMPT = args.prompt;
    if (args.action === 'send-message' && args.prompt) makeArgs.MESSAGE = args.prompt;
    if (args.repo) makeArgs.REPO = args.repo;
    if (args.title) makeArgs.TITLE = args.title;
    if (args.branch) makeArgs.BRANCH = args.branch;
    
    const cmdResult = await this.make.run(targetName, makeArgs);
    return `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
  }
}

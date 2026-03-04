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
    if ((args.action === 'send-message' || args.action === 'sendMessage') && args.prompt) {
      makeArgs.MESSAGE = args.prompt;
    }
    if (args.repo) makeArgs.REPO = args.repo;
    if (args.title) makeArgs.TITLE = args.title;
    if (args.branch) makeArgs.BRANCH = args.branch;
    if (args.pageSize) makeArgs.SIZE = String(args.pageSize);
    
    // Special handling for the action name to match Makefile targets
    let finalTarget = targetName;
    if (args.action === 'list-activities') finalTarget = 'jules-list-activities';
    if (args.action === 'get-session') finalTarget = 'jules-get-session';
    if (args.action === 'list-sessions') finalTarget = 'jules-list-sessions';

    const cmdResult = await this.make.run(finalTarget, makeArgs);
    return `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
  }
}

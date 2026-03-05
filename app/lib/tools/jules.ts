import { Tool, ToolDefinition, ToolContext } from './base.js';
import { MakeExecutor } from '../executors/make_executor.js';

/**
 * Tool to interact with the Jules AI agent.
 */
export class JulesTool implements Tool {
  private make: MakeExecutor;

  private _toRelativeTime(isoTimestamp: string): string {
    const parsed = Date.parse(isoTimestamp);
    if (Number.isNaN(parsed)) return isoTimestamp;

    const diffMs = Date.now() - parsed;
    const absMs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    const format = (value: number, unit: string): string => {
      const plural = value === 1 ? unit : `${unit}s`;
      return diffMs >= 0 ? `${value} ${plural} ago` : `in ${value} ${plural}`;
    };

    if (absMs < minute) return diffMs >= 0 ? 'just now' : 'in a few seconds';
    if (absMs < hour) return format(Math.floor(absMs / minute), 'minute');
    if (absMs < day) return format(Math.floor(absMs / hour), 'hour');
    return format(Math.floor(absMs / day), 'day');
  }

  private _humanizeTimestamps(output: string): string {
    // Convert bracketed ISO timestamps like:
    // [2026-03-04T07:47:41.064367Z] AGENT: ...
    return output.replace(/\[([^\]]+)\]/g, (match, ts) => {
      const relative = this._toRelativeTime(ts);
      return relative === ts ? match : `[${relative}]`;
    });
  }

  readonly definition: ToolDefinition = {
    type: 'function',
    function: {
      name: 'jules',
      description: 'Interact with the Jules AI agent. Use this tool for ALL Jules operations — never use run_make with jules-* targets directly. Pass sessionId as the session identifier.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'create',
              'list-sessions',
              'get-session',
              'get-session-status',
              'get-pending-feedback',
              'send-message',
              'approve-plan',
              'list-sources',
              'list-activities',
              'delete-session',
              'fetch-latest-sessions',
            ],
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
          pageSize: {
            type: 'number',
            description: 'Number of items to return for list-sessions and list-activities (defaults to 10).',
          },
          extraArgs: {
            type: 'string',
            description: 'Any additional flags or arguments for the jules client.',
          },
        },
        required: ['action'],
      },
    },
  };

  constructor(make: MakeExecutor) {
    this.make = make;
  }

  async execute(args: any, context?: ToolContext): Promise<string> {
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
    
    // Default pageSize for list actions to prevent massive outputs
    if ((args.action === 'list-sessions' || args.action === 'list-activities') && !args.pageSize) {
      args.pageSize = 10;
    }
    if (args.pageSize) makeArgs.SIZE = String(args.pageSize);

    // Special handling for the action name to match Makefile targets
    let finalTarget = targetName;
    if (args.action === 'list-activities') finalTarget = 'jules-list-activities';
    if (args.action === 'get-session') finalTarget = 'jules-get-session';
    if (args.action === 'get-session-status') finalTarget = 'jules-get-session-status';
    if (args.action === 'get-pending-feedback') finalTarget = 'jules-get-pending-feedback';
    if (args.action === 'list-sessions') finalTarget = 'jules-list-sessions';
    if (args.action === 'fetch-latest-sessions') finalTarget = 'jules-fetch-latest-sessions';

    const cmdResult = await this.make.run(finalTarget, makeArgs);
    const humanizedStdout = this._humanizeTimestamps(cmdResult.stdout);

    // If context is available, send the output directly to the channel
    if (context && humanizedStdout) {
      await context.send(humanizedStdout);
    }

    // Return structured JSON output with a truncated stdout for the LLM
    const output = {
      stdout: humanizedStdout.length > 500 ? `${humanizedStdout.substring(0, 500)}... (full output displayed in channel)` : humanizedStdout,
      stderr: cmdResult.stderr,
      exitCode: cmdResult.exitCode,
      success: cmdResult.exitCode === 0,
      _fullStdout: humanizedStdout // Internal use for history persistence
    };

    return JSON.stringify(output);
  }
}

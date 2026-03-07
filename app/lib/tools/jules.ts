import { Tool, ToolDefinition, ToolContext } from './base.js';
import { MakeExecutor } from '../executors/make_executor.js';

const STDOUT_TRUNCATION_LIMIT = 500;
const DISCORD_CONTENT_LIMIT = 1900; // Leave some buffer under 2000 limit

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
              'archive-session',
              'fetch-latest-sessions',
              'show-cached-sessions',
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
          filter: {
            type: 'string',
            description: 'AIP-160 filter expression for list-sessions or list-activities.',
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
    if (args.filter) makeArgs.FILTER = args.filter;
    
    // Default pageSize for list actions to prevent massive outputs
    if ((args.action === 'list-sessions' || args.action === 'list-activities') && !args.pageSize) {
      args.pageSize = 10;
    }
    
    // Map pageSize to the correct parameter name for each action
    if (args.pageSize) {
      if (args.action === 'fetch-latest-sessions' || args.action === 'show-cached-sessions') {
        makeArgs.LIMIT = String(args.pageSize);
      } else if (args.action === 'list-sessions' || args.action === 'list-activities' || args.action === 'list-sources') {
        makeArgs.SIZE = String(args.pageSize);
      }
    }
    
    // Validate that no conflicting parameters are set
    if (args.action === 'fetch-latest-sessions' && makeArgs.SIZE) {
      throw new Error('fetch-latest-sessions uses LIMIT parameter, not SIZE');
    }
    if (args.action === 'show-cached-sessions' && makeArgs.SIZE) {
      throw new Error('show-cached-sessions uses LIMIT parameter, not SIZE');
    }
    if ((args.action === 'list-sessions' || args.action === 'list-activities' || args.action === 'list-sources') && makeArgs.LIMIT) {
      throw new Error(`${args.action} uses SIZE parameter, not LIMIT`);
    }

    // Special handling for the action name to match Makefile targets
    let finalTarget = targetName;
    if (args.action === 'create') finalTarget = 'jules-create-session';
    if (args.action === 'list-activities') finalTarget = 'jules-list-activities';
    if (args.action === 'get-session') finalTarget = 'jules-get-session';
    if (args.action === 'get-session-status') finalTarget = 'jules-get-session-status';
    if (args.action === 'get-pending-feedback') finalTarget = 'jules-get-pending-feedback';
    if (args.action === 'list-sessions') finalTarget = 'jules-list-sessions';
    if (args.action === 'fetch-latest-sessions') finalTarget = 'jules-fetch-latest-sessions';
    if (args.action === 'show-cached-sessions') finalTarget = 'jules-show-cached-sessions';
    if (args.action === 'archive-session') finalTarget = 'jules-archive-session';

    const cmdResult = await this.make.run(finalTarget, makeArgs);
    const humanizedStdout = this._humanizeTimestamps(cmdResult.stdout);

    // If context is available, send the output directly to the channel
    // and return minimal acknowledgment to prevent unnecessary LLM responses
    if (context && humanizedStdout) {
      // Truncate content for Discord to avoid 2000 character limit
      let discordContent = humanizedStdout;
      if (humanizedStdout.length > DISCORD_CONTENT_LIMIT) {
        discordContent = `${humanizedStdout.substring(0, DISCORD_CONTENT_LIMIT)}...\n\n*(output truncated due to Discord limits - full output available in session history)*`;
      }
      await context.send(discordContent);
      
      // Return special marker indicating no response needed
      const output = {
        stdout: "__NO_RESPONSE_NEEDED__",
        stderr: cmdResult.stderr,
        exitCode: cmdResult.exitCode,
        success: cmdResult.exitCode === 0,
        _fullStdout: humanizedStdout // Internal use for history persistence
      };
      
      return JSON.stringify(output);
    }

    // Return structured JSON output with a truncated stdout for the LLM
    const output = {
      stdout: humanizedStdout.length > STDOUT_TRUNCATION_LIMIT ? `${humanizedStdout.substring(0, STDOUT_TRUNCATION_LIMIT)}... (full output displayed in channel)` : humanizedStdout,
      stderr: cmdResult.stderr,
      exitCode: cmdResult.exitCode,
      success: cmdResult.exitCode === 0,
      _fullStdout: humanizedStdout // Internal use for history persistence
    };

    return JSON.stringify(output);
  }
}

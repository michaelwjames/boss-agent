import axios, { AxiosInstance } from 'axios';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';

// --- Types & Interfaces ---

interface GitHubBranch {
  displayName: string;
}

interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  defaultBranch?: GitHubBranch;
  branches?: GitHubBranch[];
}

interface Source {
  name: string;
  id?: string;
  githubRepo?: GitHubRepo;
}

interface PullRequest {
  url: string;
  title?: string;
  description?: string;
}

interface FileChange {
  // Define structure if needed
}

interface SessionOutput {
  pullRequest?: PullRequest;
  fileChange?: FileChange;
}

type SessionState =
  | 'STATE_UNSPECIFIED'
  | 'QUEUED'
  | 'PLANNING'
  | 'AWAITING_PLAN_APPROVAL'
  | 'AWAITING_USER_FEEDBACK'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

interface Session {
  name: string;
  id?: string;
  prompt: string;
  title?: string;
  state: SessionState;
  url?: string;
  createTime?: string;
  updateTime?: string;
  outputs?: SessionOutput[];
}

interface GitPatch {
  baseCommitId: string;
  unidiffPatch: string;
  suggestedCommitMessage?: string;
}

interface ChangeSet {
  source: string;
  gitPatch: GitPatch;
}

interface BashOutput {
  output: string;
}

interface Artifact {
  changeSet?: ChangeSet;
  bashOutput?: BashOutput;
  media?: any;
}

interface Activity {
  id: string;
  name: string;
  originator: 'USER' | 'AGENT' | 'SYSTEM';
  description: string;
  createTime: string;
  artifacts?: Artifact[];
}

interface ListSourcesResponse {
  sources: Source[];
  nextPageToken?: string;
}

interface ListSessionsResponse {
  sessions: Session[];
  nextPageToken?: string;
}

interface ListActivitiesResponse {
  activities: Activity[];
  nextPageToken?: string;
}

// --- Client Implementation ---

export class JulesClient {
  private static readonly BASE_URL = 'https://jules.googleapis.com/v1alpha';
  private api: AxiosInstance;
  private plain: boolean;

  constructor(apiKey: string, plain: boolean = false) {
    if (!apiKey) {
      throw new Error('JULES_API_KEY is required.');
    }
    this.plain = plain;
    this.api = axios.create({
      baseURL: JulesClient.BASE_URL,
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  private log(message: string, style?: 'red' | 'green' | 'blue' | 'yellow') {
    if (this.plain) {
      console.log(message);
    } else {
      if (style) {
        console.log(chalk[style](message));
      } else {
        console.log(message);
      }
    }
  }

  async listSources(pageSize: number = 30, pageToken?: string, filter?: string): Promise<ListSourcesResponse> {
    try {
      const response = await this.api.get<ListSourcesResponse>('sources', {
        params: { pageSize, pageToken, filter },
      });
      return response.data;
    } catch (error: any) {
      this.log(`Error listing sources: ${error.message}`, 'red');
      if (error.response?.data) {
        this.log(`Details: ${JSON.stringify(error.response.data)}`, 'red');
      }
      throw error;
    }
  }

  async getSource(sourceId: string): Promise<Source> {
    try {
      const response = await this.api.get<Source>(`sources/${sourceId}`);
      return response.data;
    } catch (error: any) {
      this.log(`Error getting source: ${error.message}`, 'red');
      throw error;
    }
  }

  async getSourceId(repoName: string): Promise<string> {
    try {
      const sourcesData = await this.listSources(100);
      const sources = sourcesData.sources || [];

      for (const source of sources) {
        const githubRepo = source.githubRepo;
        if (githubRepo) {
          const fullName = `${githubRepo.owner}/${githubRepo.repo}`;
          if (fullName === repoName || source.name.includes(repoName)) {
            return source.name;
          }
        }
      }

      throw new Error(`Repository '${repoName}' not found in connected sources.`);
    } catch (error: any) {
      this.log(`Error fetching sources: ${error.message}`, 'red');
      throw error;
    }
  }

  async createSession(options: {
    prompt: string;
    title?: string;
    sourceId?: string;
    startingBranch?: string;
    requirePlanApproval?: boolean;
    automationMode?: string;
  }): Promise<Session> {
    const payload: any = {
      prompt: options.prompt,
      automationMode: options.automationMode || 'AUTOMATION_MODE_UNSPECIFIED',
    };

    if (options.title) {
      payload.title = options.title;
    }

    if (options.sourceId) {
      payload.sourceContext = {
        source: options.sourceId,
        githubRepoContext: {
          startingBranch: options.startingBranch || 'main',
        },
      };
      if (!payload.title) {
        payload.title = `Task: ${options.prompt.substring(0, 30)}...`;
      }
    } else if (!payload.title) {
      payload.title = 'Repoless Session';
    }

    if (options.requirePlanApproval) {
      payload.requirePlanApproval = true;
    }

    try {
      const response = await this.api.post<Session>('sessions', payload);
      return response.data;
    } catch (error: any) {
      this.log(`Error creating session: ${error.message}`, 'red');
      if (error.response?.data) {
        this.log(`Details: ${JSON.stringify(error.response.data)}`, 'red');
      }
      throw error;
    }
  }

  async listSessions(pageSize: number = 30, pageToken?: string): Promise<ListSessionsResponse> {
    try {
      const response = await this.api.get<ListSessionsResponse>('sessions', {
        params: { pageSize, pageToken },
      });
      return response.data;
    } catch (error: any) {
      this.log(`Error listing sessions: ${error.message}`, 'red');
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<Session> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      const response = await this.api.get<Session>(`${name}`);
      return response.data;
    } catch (error: any) {
      this.log(`Error getting session: ${error.message}`, 'red');
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      await this.api.delete(`${name}`);
      return true;
    } catch (error: any) {
      this.log(`Error deleting session: ${error.message}`, 'red');
      throw error;
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<any> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      const response = await this.api.post(`${name}:sendMessage`, { prompt: message });
      return response.data;
    } catch (error: any) {
      this.log(`Error sending message: ${error.message}`, 'red');
      throw error;
    }
  }

  async approvePlan(sessionId: string): Promise<any> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      const response = await this.api.post(`${name}:approvePlan`, {});
      return response.data;
    } catch (error: any) {
      this.log(`Error approving plan: ${error.message}`, 'red');
      throw error;
    }
  }

  async listActivities(sessionId: string, pageSize: number = 50, pageToken?: string, createTime?: string): Promise<ListActivitiesResponse> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      const response = await this.api.get<ListActivitiesResponse>(`${name}/activities`, {
        params: { pageSize, pageToken, createTime },
      });
      return response.data;
    } catch (error: any) {
      this.log(`Error listing activities: ${error.message}`, 'red');
      throw error;
    }
  }

  async getActivity(sessionId: string, activityId: string): Promise<Activity> {
    const name = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    try {
      const response = await this.api.get<Activity>(`${name}/activities/${activityId}`);
      return response.data;
    } catch (error: any) {
      this.log(`Error getting activity: ${error.message}`, 'red');
      throw error;
    }
  }

  displayOutputs(outputs: SessionOutput[]) {
    if (this.plain) {
      console.log('\n--- Session Outputs ---');
      for (const output of outputs) {
        if (output.pullRequest) {
          console.log(`Type: Pull Request | URL: ${output.pullRequest.url}`);
        } else if (output.fileChange) {
          console.log(`Type: File Change | Details: Modified files available in session context`);
        } else {
          console.log(`Type: Unknown | Details: ${JSON.stringify(output)}`);
        }
      }
      return;
    }

    const table = new Table({
      head: [chalk.cyan('Type'), chalk.white('Details')],
    });

    for (const output of outputs) {
      let type = 'Unknown';
      let details = JSON.stringify(output);

      if (output.pullRequest) {
        type = 'Pull Request';
        details = output.pullRequest.url;
      } else if (output.fileChange) {
        type = 'File Change';
        details = 'Modified files available in session context';
      }

      table.push([type, details]);
    }

    console.log(table.toString());
  }

  async pollSession(sessionName: string, timeout: number = 300) {
    const seenActivities = new Set<string>();
    const startTime = Date.now();
    let spinner: any;

    if (!this.plain) {
      spinner = ora('Jules is thinking...').start();
    }

    while (true) {
      if (Date.now() - startTime > timeout * 1000) {
        const msg = `Polling timed out after ${timeout}s.`;
        if (spinner) spinner.fail(msg);
        else console.log(msg);
        break;
      }

      try {
        // 1. Check Session Status
        const session = await this.getSession(sessionName);
        const state = session.state;

        // 2. Fetch Activities
        const activitiesData = await this.listActivities(sessionName, 100);
        const activities = activitiesData.activities || [];

        // Sort by creation time
        activities.sort((a, b) => (a.createTime || '').localeCompare(b.createTime || ''));

        for (const activity of activities) {
          if (!seenActivities.has(activity.id)) {
            const description = activity.description || 'No description';
            const originator = activity.originator || 'SYSTEM';
            const timestamp = new Date(activity.createTime).toLocaleTimeString();

            if (spinner) {
              spinner.stop();
              const color = originator === 'AGENT' ? 'green' : originator === 'USER' ? 'blue' : 'white';
              console.log(`[${timestamp}] ${chalk.bold[color](originator)}: ${description}`);
              spinner.start();
            } else {
              console.log(`[${timestamp}] ${originator}: ${description}`);
            }

            seenActivities.add(activity.id);
          }
        }

        // 3. Handle Terminal States
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(state)) {
          if (spinner) {
            spinner.stop();
            const color = state === 'COMPLETED' ? 'green' : 'red';
            console.log(chalk.bold[color](`Session finished with state: ${state}`));
          } else {
            console.log(`Session finished with state: ${state}`);
          }

          if (state === 'COMPLETED' && session.outputs) {
            this.displayOutputs(session.outputs);
          }
          break;
        }

        if (state === 'AWAITING_USER_FEEDBACK' || state === 'AWAITING_PLAN_APPROVAL') {
          if (spinner) {
            spinner.stop();
            console.log(chalk.bold.yellow('Jules is waiting for your feedback (Plan Approval or Questions).'));
            console.log(`Please visit the web URL to interact: ${session.url}`);
          } else {
            console.log('Jules is waiting for your feedback (Plan Approval or Questions).');
            console.log(`Please visit the web URL to interact: ${session.url}`);
          }
          break;
        }

      } catch (error) {
        // Ignore transient errors
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// --- CLI Entry Point ---

export async function main() {
  dotenv.config();

  const program = new Command();

  program
    .name('jules-client')
    .description('Jules Terminal Client - Comprehensive API Interface')
    .option('--api-key <key>', 'Jules API Key')
    .option('--plain', 'Output plain text instead of Rich-formatted UI', false)
    .option('--timeout <seconds>', 'Max polling time in seconds', '300');

  program
    .command('create')
    .description('Create a new session')
    .requiredOption('--prompt <prompt>', 'Instruction for Jules')
    .option('--title <title>', 'Optional session title')
    .option('--repo <repo>', 'Repository name (owner/repo)')
    .option('--branch <branch>', 'Starting branch', 'main')
    .option('--context-file <path>', 'Path to a file to include as context')
    .option('--require-approval', 'Require plan approval', false)
    .option('--auto-pr', 'Automatically create PR', false)
    .option('--poll', 'Poll for updates', true)
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);

      let fullPrompt = options.prompt;
      if (options.contextFile) {
        try {
          const contextContent = await fs.readFile(options.contextFile, 'utf8');
          fullPrompt += `\n\nContext from ${options.contextFile}:\n${contextContent}`;
        } catch (error: any) {
          console.error(chalk.red(`Error: Context file ${options.contextFile} not found.`));
          process.exit(1);
        }
      }

      let sourceId: string | undefined;
      if (options.repo) {
        if (!globalOptions.plain) console.log(chalk.blue(`Resolving source for repo: ${options.repo}...`));
        else console.log(`Resolving source for repo: ${options.repo}...`);
        sourceId = await client.getSourceId(options.repo);
        if (!globalOptions.plain) console.log(chalk.green(`Found source ID: ${sourceId}`));
        else console.log(`Found source ID: ${sourceId}`);
      }

      const automationMode = options.autoPr ? 'AUTO_CREATE_PR' : 'AUTOMATION_MODE_UNSPECIFIED';

      if (!globalOptions.plain) console.log(chalk.blue('Initiating Jules session...'));
      else console.log('Initiating Jules session...');

      const session = await client.createSession({
        prompt: fullPrompt,
        title: options.title,
        sourceId: sourceId,
        startingBranch: options.branch,
        requirePlanApproval: options.requireApproval,
        automationMode,
      });

      const sessionName = session.name;
      const sessionUrl = session.url;

      if (globalOptions.plain) {
        console.log(`Session Created! ID: ${sessionName}`);
        if (sessionUrl) console.log(`Web URL: ${sessionUrl}`);
      } else {
        console.log(chalk.bold.green('Session Created!'), `ID: ${sessionName}`);
        if (sessionUrl) console.log(chalk.bold('Web URL:'), sessionUrl);
      }

      if (options.poll) {
        if (!globalOptions.plain) console.log(chalk.blue('Streaming activities...'));
        else console.log('Streaming activities...');
        await client.pollSession(sessionName, parseInt(globalOptions.timeout));
      }
    });

  program
    .command('list-sessions')
    .description('List all sessions')
    .option('--page-size <size>', 'Number of sessions to return', '30')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);

      const result = await client.listSessions(parseInt(options.pageSize));
      const sessions = result.sessions || [];

      if (sessions.length === 0) {
        console.log(globalOptions.plain ? 'No sessions found.' : chalk.yellow('No sessions found.'));
      } else {
        if (globalOptions.plain) {
          console.log('--- Sessions ---');
          for (const s of sessions) {
            console.log(`ID: ${s.name} | Title: ${s.title} | State: ${s.state}`);
          }
        } else {
          const table = new Table({
            head: [chalk.cyan('ID'), chalk.white('Title'), chalk.green('State'), chalk.blue('Created')],
          });

          for (const s of sessions) {
            table.push([s.name, s.title || '', s.state, s.createTime || '']);
          }

          console.log(table.toString());
        }

        if (result.nextPageToken) {
          console.log(globalOptions.plain ? `\nMore results available. Use next page token: ${result.nextPageToken}` : chalk.yellow(`\nMore results available. Use --page-token=${result.nextPageToken}`));
        }
      }
    });

  program
    .command('get-session')
    .description('Get session details')
    .requiredOption('--session-id <id>', 'Session ID')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      const session = await client.getSession(options.sessionId);
      console.log(JSON.stringify(session, null, 2));
    });

  program
    .command('delete-session')
    .description('Delete a session')
    .requiredOption('--session-id <id>', 'Session ID')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      await client.deleteSession(options.sessionId);
      const msg = `Session ${options.sessionId} deleted successfully.`;
      console.log(globalOptions.plain ? msg : chalk.green(msg));
    });

  program
    .command('send-message')
    .description('Send a message to a session')
    .requiredOption('--session-id <id>', 'Session ID')
    .requiredOption('--message <msg>', 'Message to send')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      await client.sendMessage(options.sessionId, options.message);
      const msg = `Message sent to session ${options.sessionId}`;
      console.log(globalOptions.plain ? msg : chalk.green(msg));
    });

  program
    .command('approve-plan')
    .description('Approve a pending plan')
    .requiredOption('--session-id <id>', 'Session ID')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      await client.approvePlan(options.sessionId);
      const msg = `Plan approved for session ${options.sessionId}`;
      console.log(globalOptions.plain ? msg : chalk.green(msg));
    });

  program
    .command('list-activities')
    .description('List session activities')
    .requiredOption('--session-id <id>', 'Session ID')
    .option('--page-size <size>', 'Number of activities to return', '50')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      const result = await client.listActivities(options.sessionId, parseInt(options.pageSize));
      const activities = result.activities || [];

      if (activities.length === 0) {
        console.log(globalOptions.plain ? 'No activities found.' : chalk.yellow('No activities found.'));
      } else {
        for (const activity of activities) {
          const originator = activity.originator || 'system';
          const description = activity.description || 'No description';
          const createTime = activity.createTime || '';

          if (globalOptions.plain) {
            console.log(`[${createTime}] ${originator.toUpperCase()}: ${description}`);
          } else {
            const color = originator === 'AGENT' ? 'green' : originator === 'USER' ? 'blue' : 'white';
            console.log(chalk[color](`[${createTime}] ${originator.toUpperCase()}: ${description}`));
          }
        }
      }
    });

  program
    .command('get-activity')
    .description('Get activity details')
    .requiredOption('--session-id <id>', 'Session ID')
    .requiredOption('--activity-id <id>', 'Activity ID')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      const activity = await client.getActivity(options.sessionId, options.activityId);
      console.log(JSON.stringify(activity, null, 2));
    });

  program
    .command('list-sources')
    .description('List all connected sources')
    .option('--page-size <size>', 'Number of sources to return', '30')
    .option('--filter <filter>', 'Filter expression')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      const result = await client.listSources(parseInt(options.pageSize), undefined, options.filter);
      const sources = result.sources || [];

      if (sources.length === 0) {
        console.log(globalOptions.plain ? 'No sources found.' : chalk.yellow('No sources found.'));
      } else {
        if (globalOptions.plain) {
          console.log('--- Connected Sources ---');
          for (const s of sources) {
            const githubRepo = s.githubRepo;
            console.log(`Name: ${s.name} | Repo: ${githubRepo?.owner}/${githubRepo?.repo}`);
          }
        } else {
          const table = new Table({
            head: [chalk.cyan('Name'), chalk.white('Owner/Repo'), chalk.green('Default Branch'), chalk.yellow('Private')],
          });

          for (const s of sources) {
            const githubRepo = s.githubRepo;
            table.push([
              s.name,
              `${githubRepo?.owner}/${githubRepo?.repo}`,
              githubRepo?.defaultBranch?.displayName || '',
              githubRepo?.isPrivate ? 'Yes' : 'No',
            ]);
          }

          console.log(table.toString());
        }
      }
    });

  program
    .command('get-source')
    .description('Get source details')
    .requiredOption('--source-id <id>', 'Source ID')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts();
      const client = new JulesClient(globalOptions.apiKey || process.env.JULES_API_KEY!, globalOptions.plain);
      const source = await client.getSource(options.sourceId);
      console.log(JSON.stringify(source, null, 2));
    });

  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) console.error(error);
    process.exit(1);
  }
}

const nodePath = realpathSync(process.argv[1]);
const scriptPath = realpathSync(fileURLToPath(import.meta.url));

if (nodePath === scriptPath) {
  main();
}

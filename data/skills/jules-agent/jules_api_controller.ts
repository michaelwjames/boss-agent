import { JulesClient } from './jules_client.js';
import dotenv from 'dotenv';

export class JulesApiController {
  private client: JulesClient;

  constructor(apiKey?: string) {
    dotenv.config();
    const key = apiKey || process.env.JULES_API_KEY;
    if (!key) {
      throw new Error('JULES_API_KEY environment variable is required');
    }
    this.client = new JulesClient({ apiKey: key });
  }

  async listSources(pageSize: number = 30, pageToken?: string, filterExpr?: string) {
    return this.client.listSources(pageSize, pageToken, filterExpr);
  }

  async getSource(sourceId: string) {
    return this.client.getSource(sourceId);
  }

  async createSession(prompt: string, title?: string, repo?: string, branch: string = 'main', requirePlanApproval: boolean = false, automationMode: string = 'AUTOMATION_MODE_UNSPECIFIED') {
    let sourceId: string | undefined;
    if (repo) {
      const sourcesData = await this.listSources(100);
      const sources = sourcesData.sources || [];
      for (const source of sources) {
        const githubRepo = source.githubRepo || {};
        const fullName = `${githubRepo.owner}/${githubRepo.repo}`;
        if (fullName === repo || source.name.includes(repo)) {
          sourceId = source.name;
          break;
        }
      }
      if (!sourceId) {
        throw new Error(`Repository '${repo}' not found in connected sources.`);
      }
    }

    const payload: any = {
      prompt,
      automationMode
    };

    if (title) payload.title = title;
    if (sourceId) {
      payload.sourceContext = {
        source: sourceId,
        githubRepoContext: {
          startingBranch: branch
        }
      };
      if (!title) payload.title = `Task: ${prompt.substring(0, 30)}...`;
    } else {
      if (!title) payload.title = 'Repoless Session';
    }

    if (requirePlanApproval) payload.requirePlanApproval = true;

    return this.client.createSession(payload);
  }

  async listSessions(pageSize: number = 30, pageToken?: string, filterExpr?: string) {
    return this.client.listSessions(pageSize, pageToken, filterExpr);
  }

  async getSession(sessionId: string) {
    return this.client.getSession(sessionId);
  }

  async deleteSession(sessionId: string) {
    return this.client.deleteSession(sessionId);
  }

  async archiveSession(sessionId: string) {
    return this.client.archiveSession(sessionId);
  }

  async sendMessage(sessionId: string, message: string) {
    return this.client.sendMessage(sessionId, message);
  }

  async approvePlan(sessionId: string) {
    return this.client.approvePlan(sessionId);
  }

  async listActivities(sessionId: string, pageSize: number = 50, pageToken?: string, filterExpr?: string) {
    return this.client.listActivities(sessionId, pageSize, pageToken, filterExpr);
  }

  async getActivity(sessionId: string, activityId: string) {
    return this.client.getActivity(sessionId, activityId);
  }
}

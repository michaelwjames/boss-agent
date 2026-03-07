import { JulesApiController } from './jules_api_controller.js';
import { JulesDatabase, SessionData } from './jules_db.js';

export class JulesService {
  private apiController: JulesApiController;
  private db: JulesDatabase;
  private defaultCacheTtl = 300; // 5 minutes
  private activeSessionCacheTtl = 30; // 30 seconds
  private activitiesCacheTtl = 60; // 1 minute

  constructor(apiKey?: string, dbPath?: string) {
    this.apiController = new JulesApiController(apiKey);
    this.db = new JulesDatabase(dbPath);
  }

  private _getSessionTtl(state?: string): number {
    const activeStates = ['PLANNING', 'IN_PROGRESS', 'QUEUED', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK'];
    if (state && activeStates.includes(state)) {
      return this.activeSessionCacheTtl;
    }
    return this.defaultCacheTtl;
  }

  async listSources(pageSize: number = 30, pageToken?: string, filterExpr?: string) {
    return this.apiController.listSources(pageSize, pageToken, filterExpr);
  }

  async getSource(sourceId: string) {
    return this.apiController.getSource(sourceId);
  }

  async createSession(prompt: string, title?: string, repo?: string, branch: string = 'main', requirePlanApproval: boolean = false, automationMode: string = 'AUTOMATION_MODE_UNSPECIFIED') {
    const session = await this.apiController.createSession(prompt, title, repo, branch, requirePlanApproval, automationMode);
    this.db.upsertSession(session);
    return session;
  }

  async listSessions(pageSize: number = 30, pageToken?: string, filterExpr?: string, forceRefresh: boolean = false) {
    if (!forceRefresh && !filterExpr) {
      const cachedSessions = this.db.listSessions(pageSize);
      if (cachedSessions.length > 0 && cachedSessions[0].last_synced_at) {
        const lastSynced = new Date(cachedSessions[0].last_synced_at).getTime();
        const age = (Date.now() - lastSynced) / 1000;
        if (age < this.defaultCacheTtl) {
          return {
            sessions: cachedSessions,
            cached: true,
            cache_age_seconds: age
          };
        }
      }
    }

    const apiResult = await this.apiController.listSessions(pageSize, pageToken, filterExpr);
    const sessions = apiResult.sessions || [];
    for (const session of sessions) {
      this.db.upsertSession(session);
    }

    if (filterExpr) {
      return {
        sessions: sessions,
        cached: false
      };
    }

    const dbSessions = this.db.listSessions(pageSize);
    return {
      sessions: dbSessions,
      cached: false,
      nextPageToken: apiResult.nextPageToken
    };
  }

  async getSession(sessionId: string, forceRefresh: boolean = false) {
    if (!forceRefresh) {
      const cached = this.db.getSession(sessionId);
      if (cached && cached.last_synced_at) {
        const lastSynced = new Date(cached.last_synced_at).getTime();
        const age = (Date.now() - lastSynced) / 1000;
        const ttl = this._getSessionTtl(cached.state);
        if (age < ttl) {
          (cached as any).cached = true;
          (cached as any).cache_age_seconds = age;
          return cached;
        }
      }
    }

    const session = await this.apiController.getSession(sessionId);
    if (session) {
      this.db.upsertSession(session);
      session.cached = false;
      return session;
    }
    return null;
  }

  async deleteSession(sessionId: string) {
    const success = await this.apiController.deleteSession(sessionId);
    this.db.deleteSession(sessionId);
    return success;
  }

  async archiveSession(sessionId: string) {
    const success = await this.apiController.archiveSession(sessionId);
    await this._refreshSessionCache(sessionId);
    return success;
  }

  async sendMessage(sessionId: string, message: string) {
    const response = await this.apiController.sendMessage(sessionId, message);
    await this._refreshSessionCache(sessionId);
    return response;
  }

  async approvePlan(sessionId: string) {
    const response = await this.apiController.approvePlan(sessionId);
    await this._refreshSessionCache(sessionId);
    return response;
  }

  async listActivities(sessionId: string, pageSize: number = 50, pageToken?: string, filterExpr?: string, forceRefresh: boolean = false) {
    if (!forceRefresh && !filterExpr) {
      const cached = this.db.getSession(sessionId);
      if (cached && cached.activities && cached.last_synced_at) {
        const lastSynced = new Date(cached.last_synced_at).getTime();
        const age = (Date.now() - lastSynced) / 1000;
        if (age < this.activitiesCacheTtl) {
          return {
            activities: cached.activities.slice(0, pageSize),
            cached: true,
            cache_age_seconds: age,
            nextPageToken: cached.activities.length > pageSize ? String(pageSize) : undefined
          };
        }
      }
    }

    const apiResult = await this.apiController.listActivities(sessionId, pageSize, pageToken, filterExpr);
    const activities = apiResult.activities || [];
    if (!filterExpr) {
      this.db.updateSessionActivities(sessionId, activities);
    }

    return {
      activities: activities,
      cached: false,
      nextPageToken: apiResult.nextPageToken
    };
  }

  async getSessionStatus(sessionId: string, includeActivities: number = 3) {
    const session = await this.getSession(sessionId, true);
    if (!session) return { error: `Session ${sessionId} not found` };

    const result: any = {
      session_id: session.name,
      title: session.title,
      state: session.state,
      update_time: session.updateTime || session.createTime
    };

    if (includeActivities > 0) {
      const actResult = await this.listActivities(sessionId, includeActivities, undefined, undefined, true);
      const activities = actResult.activities || [];
      result.recent_activities = activities.map((act: any) => {
        let type = 'unknown';
        let content = '';
        if (act.agentMessaged) {
          type = 'agent_message';
          content = act.agentMessaged.agentMessage || '';
        } else if (act.planGenerated) {
          type = 'plan_generated';
          content = `Plan with ${act.planGenerated.plan?.steps?.length || 0} steps generated`;
        } else if (act.userMessaged) {
          type = 'user_message';
          content = act.userMessaged.userMessage || '';
        } else if (act.planApproved) {
          type = 'plan_approved';
          content = 'User approved the plan';
        }
        return {
          time: act.createTime,
          type,
          content
        };
      });
    }
    return result;
  }

  async getPendingFeedback(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session) return { error: `Session ${sessionId} not found` };

    if (session.state !== 'AWAITING_USER_FEEDBACK') {
      return { error: `Session is not awaiting feedback. Current state: ${session.state}` };
    }

    const actResult = await this.listActivities(sessionId, 10, undefined, undefined, true);
    const activities = actResult.activities || [];
    for (const act of activities) {
      if (act.agentMessaged) {
        return {
          session_id: session.name,
          title: session.title,
          last_agent_message: act.agentMessaged.agentMessage || '',
          message_time: act.createTime
        };
      }
    }
    return { error: 'No recent agent message found despite awaiting feedback' };
  }

  private async _refreshSessionCache(sessionId: string) {
    try {
      const session = await this.apiController.getSession(sessionId);
      if (session) this.db.upsertSession(session);
    } catch (e) {
      console.warn(`Failed to refresh session cache for ${sessionId}:`, e);
    }
  }

  async fetchLatestSessions(limit: number = 50) {
    const existing: Record<string, { state?: string; update_time?: string }> = {};
    const cachedSessions = this.db.listSessions(limit);
    for (const s of cachedSessions) {
      existing[s.name] = { state: s.state, update_time: s.updateTime || s.createTime };
    }

    const apiResult = await this.apiController.listSessions(limit);
    const apiSessions = apiResult.sessions || [];

    const new_sessions = [];
    const updated_sessions = [];

    for (const s of apiSessions) {
      const name = s.name;
      const update_time = s.updateTime || s.createTime;

      if (!existing[name]) {
        new_sessions.push(s);
      } else {
        if (s.state !== existing[name].state || update_time !== existing[name].update_time) {
          updated_sessions.push(s);
        }
      }
      this.db.upsertSession(s);
    }

    return {
      new_sessions,
      updated_sessions,
      total_fetched: apiSessions.length
    };
  }

  getDb() {
    return this.db;
  }
}

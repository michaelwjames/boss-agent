import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

export interface SessionData {
  name: string;
  title?: string;
  state?: string;
  createTime?: string;
  updateTime?: string;
  url?: string;
  prompt?: string;
  sourceContext?: any;
  automationMode?: string;
  requirePlanApproval?: boolean;
  outputs?: any[];
  activities?: any[];
  archived?: boolean;
  last_synced_at?: string;
}

/**
 * Jules Database using the system's 'sqlite3' CLI for persistence.
 * This ensures compatibility in environments where native Node bindings for SQLite fail to load.
 */
export class JulesDatabase {
  private dbPath: string;

  constructor(dbPath?: string) {
    if (!dbPath) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const projectRoot = path.resolve(__dirname, '../../../');
      this.dbPath = path.join(projectRoot, 'data', 'jules_cache.db');
    } else {
      this.dbPath = dbPath;
    }

    this._ensureDbExists();
  }

  private _ensureDbExists(): void {
    const dbDir = path.dirname(this.dbPath);
    fs.ensureDirSync(dbDir);

    const schema = `
      CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          title TEXT,
          state TEXT,
          create_time TEXT,
          update_time TEXT,
          url TEXT,
          prompt TEXT,
          source_context TEXT,
          automation_mode TEXT,
          require_plan_approval INTEGER,
          outputs TEXT,
          activities TEXT,
          last_synced_at TEXT,
          archived INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
      CREATE INDEX IF NOT EXISTS idx_sessions_create_time ON sessions(create_time DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);
    `;

    try {
      this._executeSql(schema);
    } catch (e) {
      console.error('Failed to initialize Jules SQLite DB:', e);
    }
  }

  private _executeSql(sql: string): string {
    const tempSqlFile = path.join(path.dirname(this.dbPath), 'temp_query.sql');
    fs.writeFileSync(tempSqlFile, sql);
    try {
      const result = execSync(`sqlite3 "${this.dbPath}" < "${tempSqlFile}"`, { encoding: 'utf8' });
      return result;
    } finally {
      if (fs.existsSync(tempSqlFile)) fs.unlinkSync(tempSqlFile);
    }
  }

  private _executeSqlWithJson(sql: string): any[] {
    const tempSqlFile = path.join(path.dirname(this.dbPath), 'temp_query.sql');
    fs.writeFileSync(tempSqlFile, sql);
    try {
      const result = execSync(`sqlite3 -json "${this.dbPath}" < "${tempSqlFile}"`, { encoding: 'utf8' });
      if (!result.trim()) return [];
      return JSON.parse(result);
    } catch (e) {
      return [];
    } finally {
      if (fs.existsSync(tempSqlFile)) fs.unlinkSync(tempSqlFile);
    }
  }

  upsertSession(session: SessionData): boolean {
    const now = new Date().toISOString();
    const archived = session.archived ? 1 : 0;
    const requirePlanApproval = session.requirePlanApproval ? 1 : 0;

    const activities = session.activities ? JSON.stringify(session.activities).replace(/'/g, "''") : 'NULL';
    const outputs = session.outputs ? JSON.stringify(session.outputs).replace(/'/g, "''") : 'NULL';
    const sourceContext = session.sourceContext ? JSON.stringify(session.sourceContext).replace(/'/g, "''") : 'NULL';

    const sql = `
      INSERT INTO sessions (
          name, title, state, create_time, update_time, url,
          prompt, source_context, automation_mode, require_plan_approval,
          outputs, activities, last_synced_at, archived
      ) VALUES (
          '${session.name}',
          '${(session.title || "").replace(/'/g, "''")}',
          '${(session.state || "").replace(/'/g, "''")}',
          '${(session.createTime || "").replace(/'/g, "''")}',
          '${(session.updateTime || session.createTime || "").replace(/'/g, "''")}',
          '${(session.url || "").replace(/'/g, "''")}',
          '${(session.prompt || "").replace(/'/g, "''")}',
          ${sourceContext === 'NULL' ? 'NULL' : "'" + sourceContext + "'"},
          '${(session.automationMode || "").replace(/'/g, "''")}',
          ${requirePlanApproval},
          ${outputs === 'NULL' ? 'NULL' : "'" + outputs + "'"},
          ${activities === 'NULL' ? 'NULL' : "'" + activities + "'"},
          '${now}',
          ${archived}
      )
      ON CONFLICT(name) DO UPDATE SET
          title = excluded.title,
          state = excluded.state,
          create_time = excluded.create_time,
          update_time = excluded.update_time,
          url = excluded.url,
          prompt = excluded.prompt,
          source_context = excluded.source_context,
          automation_mode = excluded.automation_mode,
          require_plan_approval = excluded.require_plan_approval,
          outputs = excluded.outputs,
          activities = excluded.activities,
          last_synced_at = excluded.last_synced_at,
          archived = excluded.archived;
    `;

    this._executeSql(sql);
    return true;
  }

  updateSessionActivities(sessionId: string, activities: any[]): boolean {
    const activitiesJson = JSON.stringify(activities).replace(/'/g, "''");
    const now = new Date().toISOString();
    const sql = `UPDATE sessions SET activities = '${activitiesJson}', last_synced_at = '${now}' WHERE name = '${sessionId}';`;
    this._executeSql(sql);
    return true;
  }

  getSession(sessionId: string): SessionData | null {
    const sql = `SELECT * FROM sessions WHERE name = '${sessionId}';`;
    const rows = this._executeSqlWithJson(sql);
    if (rows.length > 0) {
      return this._mapRowToSession(rows[0]);
    }
    return null;
  }

  listSessions(limit: number = 50, stateFilter?: string, includeArchived: boolean = false): SessionData[] {
    let sql = "SELECT * FROM sessions ";
    const clauses = [];
    if (stateFilter) clauses.push(`state = '${stateFilter}'`);
    if (!includeArchived) clauses.push("archived = 0");

    if (clauses.length > 0) {
      sql += "WHERE " + clauses.join(" AND ") + " ";
    }

    sql += `ORDER BY create_time DESC LIMIT ${limit};`;
    const rows = this._executeSqlWithJson(sql);
    return rows.map(r => this._mapRowToSession(r));
  }

  deleteSession(sessionId: string): boolean {
    const sql = `DELETE FROM sessions WHERE name = '${sessionId}';`;
    this._executeSql(sql);
    return true;
  }

  getSessionCount(): number {
    const sql = "SELECT COUNT(*) as count FROM sessions;";
    const rows = this._executeSqlWithJson(sql);
    return rows.length > 0 ? rows[0].count : 0;
  }

  private _mapRowToSession(row: any): SessionData {
    return {
      name: row.name,
      title: row.title,
      state: row.state,
      createTime: row.create_time,
      updateTime: row.update_time,
      url: row.url,
      prompt: row.prompt,
      sourceContext: row.source_context ? JSON.parse(row.source_context) : null,
      automationMode: row.automation_mode,
      requirePlanApproval: row.require_plan_approval === 1,
      outputs: row.outputs ? JSON.parse(row.outputs) : null,
      activities: row.activities ? JSON.parse(row.activities) : null,
      archived: row.archived === 1,
      last_synced_at: row.last_synced_at
    };
  }

  static parseSourceContext(sourceContext: any): { repo_name: string | null; branch_name: string | null } {
    const result: { repo_name: string | null; branch_name: string | null } = { repo_name: null, branch_name: null };
    if (!sourceContext) return result;
    try {
      const source = sourceContext.source || '';
      if (source && source.includes('sources/github/')) {
        const parts = source.split('/');
        if (parts.length >= 4) result.repo_name = `${parts[2]}/${parts[3]}`;
      }
      if (sourceContext.githubRepoContext) result.branch_name = sourceContext.githubRepoContext.startingBranch;
    } catch (e) {}
    return result;
  }

  static formatTimestampHuman(isoTimestamp?: string): string {
    if (!isoTimestamp) return 'Unknown';
    try {
      const date = new Date(isoTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const absDiff = Math.abs(diffMs);
      const minute = 60000;
      const hour = 3600000;
      const day = 86400000;
      if (absDiff < minute) return diffMs >= 0 ? 'just now' : 'in a few seconds';
      if (absDiff < hour) {
        const m = Math.floor(absDiff / minute);
        return `${m} minute${m !== 1 ? 's' : ''} ${diffMs >= 0 ? 'ago' : 'from now'}`;
      }
      if (absDiff < day) {
        const h = Math.floor(absDiff / hour);
        return `${h} hour${h !== 1 ? 's' : ''} ${diffMs >= 0 ? 'ago' : 'from now'}`;
      }
      const d = Math.floor(absDiff / day);
      return `${d} day${d !== 1 ? 's' : ''} ${diffMs >= 0 ? 'ago' : 'from now'}`;
    } catch (e) { return isoTimestamp; }
  }

  clearOldSessions(daysOld: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const sql = `DELETE FROM sessions WHERE create_time < '${cutoff.toISOString()}';`;
    this._executeSql(sql);
    return 0;
  }
}

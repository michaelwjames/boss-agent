import sqlite3
import json
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

class JulesDatabase:
    """SQLite repository for Jules sessions and activities."""
    
    def __init__(self, db_path: str = None):
        """Initialize the database connection.
        
        Args:
            db_path: Path to SQLite database file. Defaults to data/jules_cache.db
        """
        if db_path is None:
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            db_path = os.path.join(project_root, 'data', 'jules_cache.db')
        
        self.db_path = db_path
        db_dir = os.path.dirname(self.db_path)
        os.makedirs(db_dir, exist_ok=True)
        self._ensure_db_exists()
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _ensure_db_exists(self):
        """Create database and tables if they don't exist."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            
            # Check if archived column exists, if not add it
            cursor.execute("PRAGMA table_info(sessions)")
            columns = [col[1] for col in cursor.fetchall()]
            
            if not columns:
                cursor.execute("""
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
                    )
                """)
            elif 'archived' not in columns:
                cursor.execute("ALTER TABLE sessions ADD COLUMN archived INTEGER DEFAULT 0")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_create_time ON sessions(create_time DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived)")
            
            conn.commit()
        finally:
            conn.close()
    
    def upsert_session(self, session_data: Dict[str, Any]) -> bool:
        """Insert or update a session in the database."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            session_name = session_data.get('name', '')
            
            activities_json = json.dumps(session_data['activities']) if 'activities' in session_data else None
            outputs_json = json.dumps(session_data['outputs']) if 'outputs' in session_data else None
            source_context_json = json.dumps(session_data['sourceContext']) if 'sourceContext' in session_data else None
            
            now = datetime.utcnow().isoformat()
            archived = 1 if session_data.get('archived', False) else 0
            
            cursor.execute("""
                INSERT INTO sessions (
                    name, title, state, create_time, update_time, url,
                    prompt, source_context, automation_mode, require_plan_approval,
                    outputs, activities, last_synced_at, archived
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    archived = excluded.archived
            """, (
                session_name,
                session_data.get('title', ''),
                session_data.get('state', ''),
                session_data.get('createTime', ''),
                session_data.get('updateTime', session_data.get('createTime', '')),
                session_data.get('url', ''),
                session_data.get('prompt', ''),
                source_context_json,
                session_data.get('automationMode', ''),
                1 if session_data.get('requirePlanApproval', False) else 0,
                outputs_json,
                activities_json,
                now,
                archived
            ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error upserting session: {e}")
            return False
        finally:
            conn.close()
    
    def update_session_activities(self, session_id: str, activities: List[Dict[str, Any]]) -> bool:
        """Update the activities JSON blob for a session."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            activities_json = json.dumps(activities)
            now = datetime.utcnow().isoformat()
            
            cursor.execute("""
                UPDATE sessions 
                SET activities = ?, last_synced_at = ?
                WHERE name = ?
            """, (activities_json, now, session_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating session activities: {e}")
            return False
        finally:
            conn.close()
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a session by ID."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE name = ?", (session_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
        finally:
            conn.close()
    
    def list_sessions(
        self,
        limit: int = 50,
        state_filter: Optional[str] = None,
        include_archived: bool = False
    ) -> List[Dict[str, Any]]:
        """List sessions with optional filtering."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            query = "SELECT * FROM sessions "
            params = []
            
            where_clauses = []
            if state_filter:
                where_clauses.append("state = ?")
                params.append(state_filter)

            if not include_archived:
                where_clauses.append("archived = 0")

            if where_clauses:
                query += "WHERE " + " AND ".join(where_clauses) + " "
            
            query += "ORDER BY create_time DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
        finally:
            conn.close()
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session from the database."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE name = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
    
    def get_session_count(self) -> int:
        """Get the total number of sessions in the database."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM sessions")
            row = cursor.fetchone()
            return row[0] if row else 0
        finally:
            conn.close()
    
    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert a database row to a dictionary, parsing JSON fields."""
        result = dict(row)
        for field in ['activities', 'outputs', 'source_context']:
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except json.JSONDecodeError:
                    result[field] = None
        
        if result.get('require_plan_approval') is not None:
            result['require_plan_approval'] = bool(result['require_plan_approval'])
        
        if result.get('archived') is not None:
            result['archived'] = bool(result['archived'])

        return result
    
    @staticmethod
    def parse_source_context(source_context: Optional[str]) -> Dict[str, str]:
        """Parse source_context JSON to extract repo_name and branch_name."""
        result = {'repo_name': None, 'branch_name': None}
        if not source_context:
            return result
        try:
            context = source_context if isinstance(source_context, dict) else json.loads(source_context)
            source = context.get('source', '')
            if source and 'sources/github/' in source:
                parts = source.split('/')
                if len(parts) >= 4:
                    result['repo_name'] = f"{parts[2]}/{parts[3]}"
            github_context = context.get('githubRepoContext', {})
            result['branch_name'] = github_context.get('startingBranch')
        except:
            pass
        return result
    
    @staticmethod
    def format_timestamp_human(iso_timestamp: Optional[str]) -> str:
        """Format ISO timestamp to human-readable relative time."""
        if not iso_timestamp:
            return 'Unknown'
        try:
            if '.' in iso_timestamp:
                iso_timestamp = iso_timestamp.split('.')[0] + 'Z'
            parsed = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            now = datetime.now(parsed.tzinfo)
            diff = now - parsed
            abs_diff = abs(diff)
            
            if abs_diff < timedelta(minutes=1):
                return 'just now' if diff.total_seconds() >= 0 else 'in a few seconds'
            elif abs_diff < timedelta(hours=1):
                m = int(abs_diff.total_seconds() / 60)
                return f"{m} minute{'s' if m != 1 else ''} {'ago' if diff.total_seconds() >= 0 else 'from now'}"
            elif abs_diff < timedelta(days=1):
                h = int(abs_diff.total_seconds() / 3600)
                return f"{h} hour{'s' if h != 1 else ''} {'ago' if diff.total_seconds() >= 0 else 'from now'}"
            else:
                d = int(abs_diff.total_seconds() / 86400)
                return f"{d} day{'s' if d != 1 else ''} {'ago' if diff.total_seconds() >= 0 else 'from now'}"
        except:
            return iso_timestamp
    
    def clear_old_sessions(self, days_old: int = 30) -> int:
        """Delete sessions older than specified days."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cutoff = (datetime.utcnow() - timedelta(days=days_old)).isoformat()
            cursor.execute("DELETE FROM sessions WHERE create_time < ?", (cutoff,))
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            print(f"Error clearing old sessions: {e}")
            return 0
        finally:
            conn.close()

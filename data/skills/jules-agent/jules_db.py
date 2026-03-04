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
            # Default to data/jules_cache.db relative to project root
            # jules_db.py is in data/skills/jules-agent/, so we go up 4 levels to project root
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            db_path = os.path.join(project_root, 'data', 'jules_cache.db')
        
        self.db_path = db_path
        
        # Ensure the directory exists
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
            
            # Create sessions table with auto-incrementing id and unique name
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
                    last_synced_at TEXT
                )
            """)
            
            # Create indexes for common queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_sessions_state 
                ON sessions(state)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_sessions_create_time 
                ON sessions(create_time DESC)
            """)
            
            conn.commit()
        finally:
            conn.close()
    
    def upsert_session(self, session_data: Dict[str, Any]) -> bool:
        """Insert or update a session in the database.
        
        Args:
            session_data: Dictionary containing session data from Jules API
            
        Returns:
            True if successful
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            
            # Extract relevant fields from session data
            session_name = session_data.get('name', '')
            
            # Prepare activities JSON blob
            activities_json = None
            if 'activities' in session_data:
                activities_json = json.dumps(session_data['activities'])
            
            # Prepare outputs JSON blob
            outputs_json = None
            if 'outputs' in session_data:
                outputs_json = json.dumps(session_data['outputs'])
            
            # Prepare source context JSON blob
            source_context_json = None
            if 'sourceContext' in session_data:
                source_context_json = json.dumps(session_data['sourceContext'])
            
            now = datetime.utcnow().isoformat()
            
            # Use INSERT OR REPLACE to handle both insert and update
            cursor.execute("""
                INSERT OR REPLACE INTO sessions (
                    name, title, state, create_time, update_time, url,
                    prompt, source_context, automation_mode, require_plan_approval,
                    outputs, activities, last_synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                now
            ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error upserting session: {e}")
            return False
        finally:
            conn.close()
    
    def update_session_activities(self, session_id: str, activities: List[Dict[str, Any]]) -> bool:
        """Update the activities JSON blob for a session.
        
        Args:
            session_id: The session ID (name field)
            activities: List of activity objects from Jules API
            
        Returns:
            True if successful
        """
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
        """Retrieve a session by ID.
        
        Args:
            session_id: The session ID (name field)
            
        Returns:
            Session dictionary or None if not found
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM sessions WHERE name = ?",
                (session_id,)
            )
            row = cursor.fetchone()
            
            if row:
                return self._row_to_dict(row)
            return None
        finally:
            conn.close()
    
    def list_sessions(
        self,
        limit: int = 50,
        state_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List sessions with optional filtering.
        
        Args:
            limit: Maximum number of sessions to return
            state_filter: Optional state to filter by (e.g., 'COMPLETED', 'FAILED')
            
        Returns:
            List of session dictionaries
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            
            if state_filter:
                cursor.execute("""
                    SELECT * FROM sessions 
                    WHERE state = ?
                    ORDER BY create_time DESC 
                    LIMIT ?
                """, (state_filter, limit))
            else:
                cursor.execute("""
                    SELECT * FROM sessions 
                    ORDER BY create_time DESC 
                    LIMIT ?
                """, (limit,))
            
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
        finally:
            conn.close()
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session from the database.
        
        Args:
            session_id: The session ID (name field)
            
        Returns:
            True if session was deleted
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE name = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
    
    def get_session_count(self) -> int:
        """Get the total number of sessions in the database.
        
        Returns:
            Count of sessions
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM sessions")
            row = cursor.fetchone()
            return row[0] if row else 0
        finally:
            conn.close()
    
    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert a database row to a dictionary, parsing JSON fields.
        
        Args:
            row: SQLite row object
            
        Returns:
            Dictionary representation
        """
        result = dict(row)
        
        # Parse JSON fields
        for field in ['activities', 'outputs', 'source_context']:
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except json.JSONDecodeError:
                    result[field] = None
        
        # Convert boolean fields
        if result.get('require_plan_approval') is not None:
            result['require_plan_approval'] = bool(result['require_plan_approval'])
        
        return result
    
    @staticmethod
    def parse_source_context(source_context: Optional[str]) -> Dict[str, str]:
        """Parse source_context JSON to extract repo_name and branch_name.
        
        Args:
            source_context: JSON string or dict containing source context
            
        Returns:
            Dict with 'repo_name' and 'branch_name' keys
        """
        result = {'repo_name': None, 'branch_name': None}
        
        if not source_context:
            return result
        
        try:
            # Handle both dict (already parsed) and JSON string
            if isinstance(source_context, dict):
                context = source_context
            else:
                context = json.loads(source_context)
            
            # Extract repo_name from source field
            source = context.get('source', '')
            if source and 'sources/github/' in source:
                # source format: "sources/github/owner/repo"
                parts = source.split('/')
                if len(parts) >= 4:
                    result['repo_name'] = f"{parts[2]}/{parts[3]}"
            
            # Extract branch_name from githubRepoContext
            github_context = context.get('githubRepoContext', {})
            result['branch_name'] = github_context.get('startingBranch')
            
        except (json.JSONDecodeError, KeyError, AttributeError, TypeError):
            pass
        
        return result
    
    @staticmethod
    def format_timestamp_human(iso_timestamp: Optional[str]) -> str:
        """Format ISO timestamp to human-readable relative time.
        
        Args:
            iso_timestamp: ISO 8601 timestamp string
            
        Returns:
            Human-readable relative time string
        """
        if not iso_timestamp:
            return 'Unknown'
        
        try:
            # Strip microseconds if present (Python 3.9 doesn't handle them in fromisoformat)
            if '.' in iso_timestamp:
                iso_timestamp = iso_timestamp.split('.')[0] + 'Z'
            
            parsed = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            now = datetime.now(parsed.tzinfo)
            diff = now - parsed
            abs_diff = abs(diff)
            
            minute = timedelta(minutes=1)
            hour = timedelta(hours=1)
            day = timedelta(days=1)
            
            if abs_diff < minute:
                return 'just now' if diff.total_seconds() >= 0 else 'in a few seconds'
            elif abs_diff < hour:
                minutes = int(abs_diff.total_seconds() / 60)
                suffix = 'ago' if diff.total_seconds() >= 0 else 'from now'
                plural = 's' if minutes != 1 else ''
                return f"{minutes} minute{plural} {suffix}"
            elif abs_diff < day:
                hours = int(abs_diff.total_seconds() / 3600)
                suffix = 'ago' if diff.total_seconds() >= 0 else 'from now'
                plural = 's' if hours != 1 else ''
                return f"{hours} hour{plural} {suffix}"
            else:
                days = int(abs_diff.total_seconds() / 86400)
                suffix = 'ago' if diff.total_seconds() >= 0 else 'from now'
                plural = 's' if days != 1 else ''
                return f"{days} day{plural} {suffix}"
        except:
            return iso_timestamp
    
    def clear_old_sessions(self, days_old: int = 30) -> int:
        """Delete sessions older than specified days.
        
        Args:
            days_old: Number of days to keep sessions
            
        Returns:
            Number of sessions deleted
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            
            cutoff_date = datetime.utcnow().replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            cutoff_date = cutoff_date.replace(day=cutoff_date.day - days_old)
            cutoff_str = cutoff_date.isoformat()
            
            cursor.execute("""
                DELETE FROM sessions 
                WHERE create_time < ?
            """, (cutoff_str,))
            
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            print(f"Error clearing old sessions: {e}")
            return 0
        finally:
            conn.close()

import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from jules_db import JulesDatabase
from jules_api_controller import JulesApiController

class JulesService:
    """Service layer for Jules operations with caching."""
    
    def __init__(self, api_key: Optional[str] = None, db_path: Optional[str] = None):
        """Initialize the Jules service."""
        self.api_controller = JulesApiController(api_key)
        self.db = JulesDatabase(db_path)
        
        # Cache TTL settings (in seconds)
        self.default_cache_ttl = 300  # 5 minutes
        self.active_session_cache_ttl = 30  # 30 seconds for active sessions
        self.activities_cache_ttl = 60  # 1 minute
    
    def _get_session_ttl(self, state: Optional[str]) -> int:
        """Determine TTL based on session state."""
        if state in ["PLANNING", "IN_PROGRESS", "QUEUED", "AWAITING_PLAN_APPROVAL", "AWAITING_USER_FEEDBACK"]:
            return self.active_session_cache_ttl
        return self.default_cache_ttl

    def list_sources(
        self,
        page_size: int = 30,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all sources (repositories) connected to your account."""
        return self.api_controller.list_sources(
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
    
    def get_source(self, source_id: str) -> Dict[str, Any]:
        """Retrieves a single source by ID."""
        return self.api_controller.get_source(source_id)
    
    def create_session(
        self,
        prompt: str,
        title: Optional[str] = None,
        repo: Optional[str] = None,
        branch: str = "main",
        require_plan_approval: bool = False,
        automation_mode: str = "AUTOMATION_MODE_UNSPECIFIED"
    ) -> Dict[str, Any]:
        """Creates a new Jules session and stores it in the database."""
        session = self.api_controller.create_session(
            prompt=prompt,
            title=title,
            repo=repo,
            branch=branch,
            require_plan_approval=require_plan_approval,
            automation_mode=automation_mode
        )
        
        # Store the new session in the database
        self.db.upsert_session(session)
        
        return session
    
    def list_sessions(
        self,
        page_size: int = 30,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Lists all sessions, using cached data when available."""
        # If we have cached sessions and they're fresh enough, return them
        # Note: Basic caching ignores filter_expr for now for simplicity in local DB
        if not force_refresh and not filter_expr:
            cached_sessions = self.db.list_sessions(limit=page_size)
            
            # Check if cache is still valid
            if cached_sessions and cached_sessions[0].get('last_synced_at'):
                try:
                    last_synced = datetime.fromisoformat(cached_sessions[0]['last_synced_at'])
                    cache_age = (datetime.utcnow() - last_synced).total_seconds()
                    
                    if cache_age < self.default_cache_ttl:
                        return {
                            'sessions': cached_sessions,
                            'cached': True,
                            'cache_age_seconds': cache_age
                        }
                except (ValueError, TypeError):
                    pass
        
        # Fetch fresh data from API
        api_result = self.api_controller.list_sessions(
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
        
        # Store fetched sessions in database
        sessions = api_result.get('sessions', [])
        for session in sessions:
            self.db.upsert_session(session)
        
        # Return sessions from DB (which now has fresh data)
        # If filtered, we return the API result directly since local DB doesn't support AIP-160
        if filter_expr:
            return {
                'sessions': sessions,
                'cached': False
            }

        db_sessions = self.db.list_sessions(limit=page_size)
        
        result = {
            'sessions': db_sessions,
            'cached': False
        }
        
        if 'nextPageToken' in api_result:
            result['nextPageToken'] = api_result['nextPageToken']
        
        return result
    
    def get_session(
        self,
        session_id: str,
        force_refresh: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Retrieves a single session by ID, using cache when available."""
        # Try to get from cache first
        if not force_refresh:
            cached_session = self.db.get_session(session_id)
            
            if cached_session and cached_session.get('last_synced_at'):
                try:
                    last_synced = datetime.fromisoformat(cached_session['last_synced_at'])
                    cache_age = (datetime.utcnow() - last_synced).total_seconds()
                    
                    ttl = self._get_session_ttl(cached_session.get('state'))
                    if cache_age < ttl:
                        cached_session['cached'] = True
                        cached_session['cache_age_seconds'] = cache_age
                        return cached_session
                except (ValueError, TypeError):
                    pass
        
        # Fetch fresh data from API
        session = self.api_controller.get_session(session_id)
        
        if session:
            # Store in database
            self.db.upsert_session(session)
            session['cached'] = False
            return session
        
        return None
    
    def delete_session(self, session_id: str) -> bool:
        """Deletes a session from both the API and database."""
        api_success = self.api_controller.delete_session(session_id)
        self.db.delete_session(session_id)
        return api_success

    def archive_session(self, session_id: str) -> bool:
        """Archives a session."""
        api_success = self.api_controller.archive_session(session_id)
        # Refresh from API to update local archived state
        self._refresh_session_cache(session_id)
        return api_success
    
    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Sends a message to a session and updates cache."""
        response = self.api_controller.send_message(session_id, message)
        self._refresh_session_cache(session_id)
        return response
    
    def approve_plan(self, session_id: str) -> Dict[str, Any]:
        """Approves a pending plan in a session and updates cache."""
        response = self.api_controller.approve_plan(session_id)
        self._refresh_session_cache(session_id)
        return response
    
    def list_activities(
        self,
        session_id: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Lists activities for a session, using cache when available."""
        # Try to get from cache first
        if not force_refresh and not filter_expr:
            cached_session = self.db.get_session(session_id)
            
            if cached_session and cached_session.get('activities') and cached_session.get('last_synced_at'):
                try:
                    last_synced = datetime.fromisoformat(cached_session['last_synced_at'])
                    cache_age = (datetime.utcnow() - last_synced).total_seconds()
                    
                    if cache_age < self.activities_cache_ttl:
                        activities = cached_session.get('activities', [])
                        
                        result = {
                            'activities': activities[:page_size],
                            'cached': True,
                            'cache_age_seconds': cache_age
                        }
                        
                        if len(activities) > page_size:
                            result['nextPageToken'] = str(page_size)
                        
                        return result
                except (ValueError, TypeError):
                    pass
        
        # Fetch fresh data from API
        api_result = self.api_controller.list_activities(
            session_id=session_id,
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
        
        # Store activities in database (only if not filtered)
        activities = api_result.get('activities', [])
        if not filter_expr:
            self.db.update_session_activities(session_id, activities)
        
        # Return activities
        result = {
            'activities': activities,
            'cached': False
        }
        
        if 'nextPageToken' in api_result:
            result['nextPageToken'] = api_result['nextPageToken']
        
        return result
    
    def get_activity(self, session_id: str, activity_id: str) -> Dict[str, Any]:
        """Retrieves a single activity by ID."""
        return self.api_controller.get_activity(session_id, activity_id)
    
    def get_session_count(self) -> int:
        """Get the total number of sessions in the database."""
        return self.db.get_session_count()
    
    def clear_old_sessions(self, days_old: int = 30) -> int:
        """Delete sessions older than specified days."""
        return self.db.clear_old_sessions(days_old)
    
    def get_session_status(self, session_id: str, include_activities: int = 3) -> Dict[str, Any]:
        """Get the current state of a session and its recent activities."""
        session = self.get_session(session_id, force_refresh=True)
        if not session:
            return {"error": f"Session {session_id} not found"}
            
        result = {
            "session_id": session.get("name"),
            "title": session.get("title"),
            "state": session.get("state"),
            "update_time": session.get("updateTime", session.get("createTime"))
        }
        
        if include_activities > 0:
            activities_result = self.list_activities(
                session_id, 
                page_size=include_activities, 
                force_refresh=True
            )
            activities = activities_result.get("activities", [])
            
            formatted_activities = []
            for act in activities:
                activity_type = "unknown"
                content = ""
                
                if "agentMessaged" in act:
                    activity_type = "agent_message"
                    content = act["agentMessaged"].get("agentMessage", "")
                elif "planGenerated" in act:
                    activity_type = "plan_generated"
                    steps = act["planGenerated"].get("plan", {}).get("steps", [])
                    content = f"Plan with {len(steps)} steps generated"
                elif "userMessaged" in act:
                    activity_type = "user_message"
                    content = act["userMessaged"].get("userMessage", "")
                elif "planApproved" in act:
                    activity_type = "plan_approved"
                    content = "User approved the plan"
                    
                formatted_activities.append({
                    "time": act.get("createTime"),
                    "type": activity_type,
                    "content": content
                })
                
            result["recent_activities"] = formatted_activities
            
        return result
        
    def get_pending_feedback(self, session_id: str) -> Dict[str, Any]:
        """Get the last agent message for a session awaiting feedback."""
        session = self.get_session(session_id)
        if not session:
            return {"error": f"Session {session_id} not found"}
            
        state = session.get("state")
        if state != "AWAITING_USER_FEEDBACK":
            return {"error": f"Session is not awaiting feedback. Current state: {state}"}
            
        activities_result = self.list_activities(session_id, page_size=10, force_refresh=True)
        activities = activities_result.get("activities", [])
        
        for act in activities:
            if "agentMessaged" in act:
                return {
                    "session_id": session.get("name"),
                    "title": session.get("title"),
                    "last_agent_message": act["agentMessaged"].get("agentMessage", ""),
                    "message_time": act.get("createTime")
                }
                
        return {"error": "No recent agent message found despite awaiting feedback"}
        
    def _refresh_session_cache(self, session_id: str):
        """Helper method to refresh session cache from API."""
        try:
            session = self.api_controller.get_session(session_id)
            if session:
                self.db.upsert_session(session)
        except Exception as e:
            print(f"Warning: Failed to refresh session cache for {session_id}: {e}")
    
    def fetch_latest_sessions(self, limit: int = 50) -> Dict[str, Any]:
        """Fetch latest sessions from API, update cache, and return only new/updated sessions."""
        existing_sessions = {}
        cached_sessions = self.db.list_sessions(limit=limit)
        for session in cached_sessions:
            existing_sessions[session['name']] = {
                'state': session.get('state'),
                'update_time': session.get('update_time')
            }
        
        api_result = self.api_controller.list_sessions(page_size=limit)
        api_sessions = api_result.get('sessions', [])
        
        new_sessions = []
        updated_sessions = []
        
        for session in api_sessions:
            session_name = session.get('name')
            session_state = session.get('state')
            session_update_time = session.get('updateTime', session.get('createTime'))
            
            if session_name not in existing_sessions:
                new_sessions.append(session)
            else:
                cached_state = existing_sessions[session_name]['state']
                cached_update_time = existing_sessions[session_name]['update_time']
                
                if session_state != cached_state or session_update_time != cached_update_time:
                    updated_sessions.append(session)
            
            self.db.upsert_session(session)
        
        return {
            'new_sessions': new_sessions,
            'updated_sessions': updated_sessions,
            'total_fetched': len(api_sessions)
        }

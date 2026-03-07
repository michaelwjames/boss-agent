import os
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

class JulesApiController:
    """Controller for making API calls to Jules."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the API controller.
        
        Args:
            api_key: Jules API key. If not provided, loads from JULES_API_KEY env var.
        """
        load_dotenv()
        self.api_key = api_key or os.getenv("JULES_API_KEY")
        
        if not self.api_key:
            raise ValueError("JULES_API_KEY environment variable is required")
        
        # Import JulesClient here to avoid circular imports
        from jules_client import JulesClient
        self.client = JulesClient(self.api_key)
    
    def list_sources(
        self,
        page_size: int = 30,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all sources (repositories) connected to your account."""
        return self.client.list_sources(
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
    
    def get_source(self, source_id: str) -> Dict[str, Any]:
        """Retrieves a single source by ID."""
        return self.client.get_source(source_id)
    
    def get_source_id(self, repo_name: str) -> str:
        """Finds the internal Source ID for a given GitHub repository name."""
        return self.client.get_source_id(repo_name)
    
    def create_session(
        self,
        prompt: str,
        title: Optional[str] = None,
        repo: Optional[str] = None,
        branch: str = "main",
        require_plan_approval: bool = False,
        automation_mode: str = "AUTOMATION_MODE_UNSPECIFIED"
    ) -> Dict[str, Any]:
        """Creates a new Jules session."""
        source_id = None
        if repo:
            source_id = self.client.get_source_id(repo)
        
        return self.client.create_session(
            prompt=prompt,
            title=title,
            source_id=source_id,
            starting_branch=branch,
            require_plan_approval=require_plan_approval,
            automation_mode=automation_mode
        )
    
    def list_sessions(
        self,
        page_size: int = 30,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all sessions for the authenticated user."""
        return self.client.list_sessions(
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
    
    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieves a single session by ID."""
        return self.client.get_session(session_id)
    
    def delete_session(self, session_id: str) -> bool:
        """Deletes a session."""
        return self.client.delete_session(session_id)

    def archive_session(self, session_id: str) -> bool:
        """Archives a session."""
        return self.client.archive_session(session_id)
    
    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Sends a message from the user to an active session."""
        return self.client.send_message(session_id, message)
    
    def approve_plan(self, session_id: str) -> Dict[str, Any]:
        """Approves a pending plan in a session."""
        return self.client.approve_plan(session_id)
    
    def list_activities(
        self,
        session_id: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        filter_expr: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all activities for a session."""
        return self.client.list_activities(
            session_id=session_id,
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
    
    def get_activity(self, session_id: str, activity_id: str) -> Dict[str, Any]:
        """Retrieves a single activity by ID."""
        return self.client.get_activity(session_id, activity_id)

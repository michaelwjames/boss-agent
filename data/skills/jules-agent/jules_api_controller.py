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
        """Lists all sources (repositories) connected to your account.
        
        Args:
            page_size: Number of sources to return (1-100). Defaults to 30.
            page_token: Page token from a previous ListSources response.
            filter_expr: Filter expression (e.g., 'name=sources/source1 OR name=sources/source2')
        
        Returns:
            Dict containing 'sources' list and optional 'nextPageToken'
        """
        return self.client.list_sources(
            page_size=page_size,
            page_token=page_token,
            filter_expr=filter_expr
        )
    
    def get_source(self, source_id: str) -> Dict[str, Any]:
        """Retrieves a single source by ID.
        
        Args:
            source_id: The source ID (e.g., 'github-myorg-myrepo')
        
        Returns:
            Dict containing source details including branches
        """
        return self.client.get_source(source_id)
    
    def get_source_id(self, repo_name: str) -> str:
        """Finds the internal Source ID for a given GitHub repository name.
        
        Args:
            repo_name: Repository name in format 'owner/repo'
        
        Returns:
            Source ID string
        """
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
        """Creates a new Jules session.
        
        Args:
            prompt: The task description for Jules to execute
            title: Optional title for the session
            repo: Repository name (owner/repo) for the session
            branch: Branch to start from (default: 'main')
            require_plan_approval: If true, plans require explicit approval
            automation_mode: 'AUTOMATION_MODE_UNSPECIFIED' or 'AUTO_CREATE_PR'
        
        Returns:
            Dict containing the created session
        """
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
        page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all sessions for the authenticated user.
        
        Args:
            page_size: Number of sessions to return (1-100). Defaults to 30.
            page_token: Page token from a previous ListSessions response.
        
        Returns:
            Dict containing 'sessions' list and optional 'nextPageToken'
        """
        return self.client.list_sessions(
            page_size=page_size,
            page_token=page_token
        )
    
    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieves a single session by ID.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            Dict containing full session details including outputs if completed
        """
        return self.client.get_session(session_id)
    
    def delete_session(self, session_id: str) -> bool:
        """Deletes a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            True if successful
        """
        return self.client.delete_session(session_id)
    
    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Sends a message from the user to an active session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            message: The message to send to the session
        
        Returns:
            Dict containing the response
        """
        return self.client.send_message(session_id, message)
    
    def approve_plan(self, session_id: str) -> Dict[str, Any]:
        """Approves a pending plan in a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            Dict containing the response
        """
        return self.client.approve_plan(session_id)
    
    def list_activities(
        self,
        session_id: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        create_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lists all activities for a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            page_size: Number of activities to return (1-100). Defaults to 50.
            page_token: Page token from a previous ListActivities response.
            create_time: Filter activities created after this timestamp
        
        Returns:
            Dict containing 'activities' list and optional 'nextPageToken'
        """
        return self.client.list_activities(
            session_id=session_id,
            page_size=page_size,
            page_token=page_token,
            create_time=create_time
        )
    
    def get_activity(self, session_id: str, activity_id: str) -> Dict[str, Any]:
        """Retrieves a single activity by ID.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            activity_id: The activity ID
        
        Returns:
            Dict containing activity details
        """
        return self.client.get_activity(session_id, activity_id)

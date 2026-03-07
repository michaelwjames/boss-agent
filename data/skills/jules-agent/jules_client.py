import os
import time
import json
import argparse
import sys
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class JulesClient:
    BASE_URL = "https://jules.googleapis.com/v1alpha"
    DEFAULT_TIMEOUT = 30  # seconds

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Jules API Key is required. Set JULES_API_KEY env var or pass it explicitly.")
        self.api_key = api_key
        self.headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        # Setup session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "DELETE"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        """Helper to make requests with default timeout."""
        if 'timeout' not in kwargs:
            kwargs['timeout'] = self.DEFAULT_TIMEOUT

        return self.session.request(method, url, headers=self.headers, **kwargs)

    def list_sources(self, page_size: int = 30, page_token: Optional[str] = None, 
                     filter_expr: Optional[str] = None) -> Dict[str, Any]:
        """Lists all sources (repositories) connected to your account."""
        url = f"{self.BASE_URL}/sources"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
        if filter_expr:
            params["filter"] = filter_expr
            
        try:
            response = self._request("GET", url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error listing sources: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def get_source(self, source_id: str) -> Dict[str, Any]:
        """Retrieves a single source by ID."""
        url = f"{self.BASE_URL}/sources/{source_id}"
        try:
            response = self._request("GET", url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error getting source: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def get_source_id(self, repo_name: str) -> str:
        """Finds the internal Source ID for a given GitHub repository name."""
        try:
            sources_data = self.list_sources(page_size=100)
            sources = sources_data.get("sources", [])
            
            for source in sources:
                github_repo = source.get("githubRepo", {})
                owner = github_repo.get("owner", "")
                repo = github_repo.get("repo", "")
                full_name = f"{owner}/{repo}"
                
                if full_name == repo_name or repo_name in source.get("name", ""):
                    return source["name"]
            
            raise ValueError(f"Repository '{repo_name}' not found in connected sources. Please connect it in the Jules web UI first.")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching sources: {e}")
            sys.exit(1)

    def create_session(self, prompt: str, title: Optional[str] = None, 
                      source_id: Optional[str] = None, starting_branch: str = "main",
                      require_plan_approval: bool = False, 
                      automation_mode: str = "AUTOMATION_MODE_UNSPECIFIED") -> Dict[str, Any]:
        """Creates a new Jules session."""
        url = f"{self.BASE_URL}/sessions"
        
        payload = {
            "prompt": prompt,
            "automationMode": automation_mode
        }
        
        if title:
            payload["title"] = title

        if source_id:
            payload["sourceContext"] = {
                "source": source_id,
                "githubRepoContext": {
                    "startingBranch": starting_branch
                }
            }
            if not title:
                payload["title"] = f"Task: {prompt[:30]}..."
        else:
            if not title:
                payload["title"] = "Repoless Session"
        
        if require_plan_approval:
            payload["requirePlanApproval"] = True

        try:
            response = self._request("POST", url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error creating session: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def list_sessions(self, page_size: int = 30, page_token: Optional[str] = None,
                      filter_expr: Optional[str] = None) -> Dict[str, Any]:
        """Lists all sessions for the authenticated user."""
        url = f"{self.BASE_URL}/sessions"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
        if filter_expr:
            params["filter"] = filter_expr
            
        try:
            response = self._request("GET", url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error listing sessions: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieves a single session by ID."""
        url = f"{self.BASE_URL}/sessions/{session_id}"
        try:
            response = self._request("GET", url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error getting session: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def delete_session(self, session_id: str) -> bool:
        """Deletes a session."""
        url = f"{self.BASE_URL}/sessions/{session_id}"
        try:
            response = self._request("DELETE", url)
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"Error deleting session: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def archive_session(self, session_id: str) -> bool:
        """Archives a session."""
        url = f"{self.BASE_URL}/sessions/{session_id}:archive"
        try:
            response = self._request("POST", url, json={})
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"Error archiving session: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Sends a message from the user to an active session."""
        url = f"{self.BASE_URL}/sessions/{session_id}:sendMessage"
        payload = {"prompt": message}
        
        try:
            response = self._request("POST", url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error sending message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def approve_plan(self, session_id: str) -> Dict[str, Any]:
        """Approves a pending plan in a session."""
        url = f"{self.BASE_URL}/sessions/{session_id}:approvePlan"
        
        try:
            response = self._request("POST", url, json={})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error approving plan: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def list_activities(self, session_id: str, page_size: int = 50, 
                       page_token: Optional[str] = None,
                       filter_expr: Optional[str] = None) -> Dict[str, Any]:
        """Lists all activities for a session."""
        url = f"{self.BASE_URL}/sessions/{session_id}/activities"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
        if filter_expr:
            params["filter"] = filter_expr
            
        try:
            response = self._request("GET", url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error listing activities: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def get_activity(self, session_id: str, activity_id: str) -> Dict[str, Any]:
        """Retrieves a single activity by ID."""
        url = f"{self.BASE_URL}/sessions/{session_id}/activities/{activity_id}"
        try:
            response = self._request("GET", url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error getting activity: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Details: {e.response.content.decode()}")
            raise

    def poll_session(self, session_name: str):
        """Polls the session for activities and status updates."""
        activities_url = f"{self.BASE_URL}/{session_name}/activities"
        session_url = f"{self.BASE_URL}/{session_name}"
        
        seen_activities = set()
        
        while True:
            # 1. Check Session Status
            try:
                sess_resp = self._request("GET", session_url)
                sess_resp.raise_for_status()
                session_data = sess_resp.json()
                state = session_data.get("state", "STATE_UNSPECIFIED")
            except Exception as e:
                print(f"Error checking status: {e}")
                break

            # 2. Fetch Activities
            try:
                act_resp = self._request("GET", activities_url)
                act_resp.raise_for_status()
                activities = act_resp.json().get("activities", [])
                
                # Sort by creation time if available
                activities.sort(key=lambda x: x.get("createTime", ""), reverse=False)

                for activity in activities:
                    act_id = activity.get("id", "unknown")
                    if act_id not in seen_activities:
                        description = activity.get("description", "No description")
                        originator = activity.get("originator", "SYSTEM")
                        
                        print(f"[{time.strftime('%H:%M:%S')}] {description}")
                        seen_activities.add(act_id)

            except Exception:
                pass # Transient network errors shouldn't crash the loop immediately

            # 3. Handle Terminal States
            if state in ["COMPLETED", "FAILED", "CANCELLED"]:
                print(f"Session finished with state: {state}")
                
                # If completed, check for outputs (files/diffs)
                if state == "COMPLETED" and "outputs" in session_data:
                    self.display_outputs(session_data["outputs"])
                break
            
            if state == "AWAITING_USER_FEEDBACK":
                print("Jules is waiting for your feedback (Plan Approval or Questions).")
                print(f"Please visit the web URL to interact: {session_data.get('url', 'URL not found')}")
                break

            time.sleep(2) # Poll interval

    def display_outputs(self, outputs: List[Dict[str, Any]]):
        """Displays output artifacts or diffs."""
        print("Session Outputs:")
        for output in outputs:
            # Handle different output types based on API spec
            output_type = "Unknown"
            details = str(output)
            
            if "pullRequest" in output:
                output_type = "Pull Request"
                details = output["pullRequest"].get("url", "No URL")
            elif "fileChange" in output:
                output_type = "File Change"
                details = "Modified files available in session context"

            print(f"  {output_type}: {details}")

def main():
    # Legacy main for jules_client.py if still used directly
    pass

if __name__ == "__main__":
    main()

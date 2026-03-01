import os
import time
import json
import argparse
import sys
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
import requests
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown
from rich.spinner import Spinner

# Initialize Rich Console
console = Console()

class JulesClient:
    BASE_URL = "https://jules.googleapis.com/v1alpha"

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Jules API Key is required. Set JULES_API_KEY env var or pass it explicitly.")
        self.api_key = api_key
        self.headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json"
        }

    def list_sources(self, page_size: int = 30, page_token: Optional[str] = None, 
                     filter_expr: Optional[str] = None) -> Dict[str, Any]:
        """Lists all sources (repositories) connected to your account.
        
        Args:
            page_size: Number of sources to return (1-100). Defaults to 30.
            page_token: Page token from a previous ListSources response.
            filter_expr: Filter expression (e.g., 'name=sources/source1 OR name=sources/source2')
        
        Returns:
            Dict containing 'sources' list and optional 'nextPageToken'
        """
        url = f"{self.BASE_URL}/sources"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
        if filter_expr:
            params["filter"] = filter_expr
            
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error listing sources:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def get_source(self, source_id: str) -> Dict[str, Any]:
        """Retrieves a single source by ID.
        
        Args:
            source_id: The source ID (e.g., 'github-myorg-myrepo')
        
        Returns:
            Dict containing source details including branches
        """
        url = f"{self.BASE_URL}/sources/{source_id}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error getting source:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
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
            console.print(f"[bold red]Error fetching sources:[/bold red] {e}")
            sys.exit(1)

    def create_session(self, prompt: str, title: Optional[str] = None, 
                      source_id: Optional[str] = None, starting_branch: str = "main",
                      require_plan_approval: bool = False, 
                      automation_mode: str = "AUTOMATION_MODE_UNSPECIFIED") -> Dict[str, Any]:
        """Creates a new Jules session.
        
        Args:
            prompt: The task description for Jules to execute
            title: Optional title for the session
            source_id: Source repository name (e.g., 'sources/github-myorg-myrepo')
            starting_branch: Branch to start from (default: 'main')
            require_plan_approval: If true, plans require explicit approval
            automation_mode: 'AUTOMATION_MODE_UNSPECIFIED' or 'AUTO_CREATE_PR'
        
        Returns:
            Dict containing the created session
        """
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
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error creating session:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def list_sessions(self, page_size: int = 30, page_token: Optional[str] = None) -> Dict[str, Any]:
        """Lists all sessions for the authenticated user.
        
        Args:
            page_size: Number of sessions to return (1-100). Defaults to 30.
            page_token: Page token from a previous ListSessions response.
        
        Returns:
            Dict containing 'sessions' list and optional 'nextPageToken'
        """
        url = f"{self.BASE_URL}/sessions"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
            
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error listing sessions:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieves a single session by ID.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            Dict containing full session details including outputs if completed
        """
        url = f"{self.BASE_URL}/sessions/{session_id}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error getting session:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def delete_session(self, session_id: str) -> bool:
        """Deletes a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            True if successful
        """
        url = f"{self.BASE_URL}/sessions/{session_id}"
        try:
            response = requests.delete(url, headers=self.headers)
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error deleting session:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def send_message(self, session_id: str, message: str) -> Dict[str, Any]:
        """Sends a message from the user to an active session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            message: The message to send to the session
        
        Returns:
            Dict containing the response
        """
        url = f"{self.BASE_URL}/sessions/{session_id}:sendMessage"
        payload = {"prompt": message}
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error sending message:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def approve_plan(self, session_id: str) -> Dict[str, Any]:
        """Approves a pending plan in a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
        
        Returns:
            Dict containing the response
        """
        url = f"{self.BASE_URL}/sessions/{session_id}:approvePlan"
        
        try:
            response = requests.post(url, headers=self.headers, json={})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error approving plan:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def list_activities(self, session_id: str, page_size: int = 50, 
                       page_token: Optional[str] = None,
                       create_time: Optional[str] = None) -> Dict[str, Any]:
        """Lists all activities for a session.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            page_size: Number of activities to return (1-100). Defaults to 50.
            page_token: Page token from a previous ListActivities response.
            create_time: Filter activities created after this timestamp
        
        Returns:
            Dict containing 'activities' list and optional 'nextPageToken'
        """
        url = f"{self.BASE_URL}/sessions/{session_id}/activities"
        params = {"pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token
        if create_time:
            params["createTime"] = create_time
            
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error listing activities:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def get_activity(self, session_id: str, activity_id: str) -> Dict[str, Any]:
        """Retrieves a single activity by ID.
        
        Args:
            session_id: The session ID (numeric part only, e.g., '1234567')
            activity_id: The activity ID
        
        Returns:
            Dict containing activity details
        """
        url = f"{self.BASE_URL}/sessions/{session_id}/activities/{activity_id}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[bold red]Error getting activity:[/bold red] {e}")
            if hasattr(e, 'response') and e.response is not None:
                console.print(f"Details: {e.response.content.decode()}")
            raise

    def poll_session(self, session_name: str):
        """Polls the session for activities and status updates."""
        activities_url = f"{self.BASE_URL}/{session_name}/activities"
        session_url = f"{self.BASE_URL}/{session_name}"
        
        seen_activities = set()
        
        with Live(Spinner("dots", text="Jules is thinking...", style="cyan"), refresh_per_second=4) as live:
            while True:
                # 1. Check Session Status
                try:
                    sess_resp = requests.get(session_url, headers=self.headers)
                    sess_resp.raise_for_status()
                    session_data = sess_resp.json()
                    state = session_data.get("state", "STATE_UNSPECIFIED")
                except Exception as e:
                    live.update(f"[red]Error checking status: {e}[/red]")
                    break

                # 2. Fetch Activities
                try:
                    act_resp = requests.get(activities_url, headers=self.headers)
                    act_resp.raise_for_status()
                    activities = act_resp.json().get("activities", [])
                    
                    # Sort by creation time if available
                    activities.sort(key=lambda x: x.get("createTime", ""), reverse=False)

                    for activity in activities:
                        act_id = activity.get("id", "unknown")
                        if act_id not in seen_activities:
                            description = activity.get("description", "No description")
                            originator = activity.get("originator", "SYSTEM")
                            
                            # Update the live display with the latest activity
                            live.update(Panel(Markdown(description), title=f"[bold {('green' if originator == 'AGENT' else 'blue')}]{originator}[/bold]"))
                            console.print(f"[{time.strftime('%H:%M:%S')}] {description}")
                            seen_activities.add(act_id)

                except Exception:
                    pass # Transient network errors shouldn't crash the loop immediately

                # 3. Handle Terminal States
                if state in ["COMPLETED", "FAILED", "CANCELLED"]:
                    live.stop()
                    console.print(Panel(f"Session finished with state: [bold]{state}[/bold]", style="green" if state == "COMPLETED" else "red"))
                    
                    # If completed, check for outputs (files/diffs)
                    if state == "COMPLETED" and "outputs" in session_data:
                        self.display_outputs(session_data["outputs"])
                    break
                
                if state == "AWAITING_USER_FEEDBACK":
                    live.stop()
                    console.print("[bold yellow]Jules is waiting for your feedback (Plan Approval or Questions).[/bold yellow]")
                    console.print(f"Please visit the web URL to interact: {session_data.get('url', 'URL not found')}")
                    break

                time.sleep(2) # Poll interval

    def display_outputs(self, outputs: List[Dict[str, Any]]):
        """Displays output artifacts or diffs."""
        table = Table(title="Session Outputs")
        table.add_column("Type", style="cyan")
        table.add_column("Details", style="white")

        for output in outputs:
            # Handle different output types based on API spec
            output_type = "Unknown"
            details = str(output)
            
            if "pullRequest" in output:
                output_type = "Pull Request"
                details = output["pullRequest"].get("url", "No URL")
            elif "fileChange" in output:
                output_type = "File Change"
                details = f"Modified files available in session context"

            table.add_row(output_type, details)

        console.print(table)

def main():
    parser = argparse.ArgumentParser(
        description="Jules Terminal Client - Comprehensive API Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create a repoless session
  python jules_client.py create --prompt "Build a FastAPI server"
  
  # Create a session with a repository
  python jules_client.py create --prompt "Add tests" --repo myorg/myrepo --branch develop
  
  # List all sessions
  python jules_client.py list-sessions
  
  # Get session details
  python jules_client.py get-session --session-id 1234567
  
  # Send a message to a session
  python jules_client.py send-message --session-id 1234567 --message "Add more tests"
  
  # Approve a plan
  python jules_client.py approve-plan --session-id 1234567
  
  # List sources
  python jules_client.py list-sources
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Create session command
    create_parser = subparsers.add_parser("create", help="Create a new session")
    create_parser.add_argument("--prompt", required=True, help="Instruction for Jules")
    create_parser.add_argument("--title", help="Optional session title")
    create_parser.add_argument("--repo", help="Repository name (owner/repo)")
    create_parser.add_argument("--branch", default="main", help="Starting branch (default: main)")
    create_parser.add_argument("--context-file", help="Path to a file to include as context")
    create_parser.add_argument("--require-approval", action="store_true", help="Require plan approval")
    create_parser.add_argument("--auto-pr", action="store_true", help="Automatically create PR")
    create_parser.add_argument("--no-poll", action="store_true", help="Don't poll for updates")
    
    # List sessions command
    list_sessions_parser = subparsers.add_parser("list-sessions", help="List all sessions")
    list_sessions_parser.add_argument("--page-size", type=int, default=30, help="Number of sessions to return")
    
    # Get session command
    get_session_parser = subparsers.add_parser("get-session", help="Get session details")
    get_session_parser.add_argument("--session-id", required=True, help="Session ID")
    
    # Delete session command
    delete_session_parser = subparsers.add_parser("delete-session", help="Delete a session")
    delete_session_parser.add_argument("--session-id", required=True, help="Session ID")
    
    # Send message command
    send_message_parser = subparsers.add_parser("send-message", help="Send a message to a session")
    send_message_parser.add_argument("--session-id", required=True, help="Session ID")
    send_message_parser.add_argument("--message", required=True, help="Message to send")
    
    # Approve plan command
    approve_plan_parser = subparsers.add_parser("approve-plan", help="Approve a pending plan")
    approve_plan_parser.add_argument("--session-id", required=True, help="Session ID")
    
    # List activities command
    list_activities_parser = subparsers.add_parser("list-activities", help="List session activities")
    list_activities_parser.add_argument("--session-id", required=True, help="Session ID")
    list_activities_parser.add_argument("--page-size", type=int, default=50, help="Number of activities to return")
    
    # Get activity command
    get_activity_parser = subparsers.add_parser("get-activity", help="Get activity details")
    get_activity_parser.add_argument("--session-id", required=True, help="Session ID")
    get_activity_parser.add_argument("--activity-id", required=True, help="Activity ID")
    
    # List sources command
    list_sources_parser = subparsers.add_parser("list-sources", help="List all connected sources")
    list_sources_parser.add_argument("--page-size", type=int, default=30, help="Number of sources to return")
    list_sources_parser.add_argument("--filter", help="Filter expression")
    
    # Get source command
    get_source_parser = subparsers.add_parser("get-source", help="Get source details")
    get_source_parser.add_argument("--source-id", required=True, help="Source ID")
    
    # Global arguments
    parser.add_argument("--api-key", help="Jules API Key")
    parser.add_argument("--format", choices=["rich", "plain", "json"], default="rich", help="Output format")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return

    # Load environment variables
    load_dotenv()
    api_key = args.api_key or os.getenv("JULES_API_KEY")

    if not api_key:
        console.print("[bold red]Error:[/bold red] JULES_API_KEY not found in environment or arguments.")
        return

    client = JulesClient(api_key)

    try:
        if args.command == "create":
            # Prepare Prompt
            full_prompt = args.prompt
            if args.context_file:
                try:
                    with open(args.context_file, 'r') as f:
                        context_content = f.read()
                        full_prompt += f"\n\nContext from {args.context_file}:\n{context_content}"
                except FileNotFoundError:
                    console.print(f"[bold red]Error:[/bold red] Context file {args.context_file} not found.")
                    return

            source_id = None
            if args.repo:
                console.print(f"[blue]Resolving source for repo: {args.repo}...[/blue]")
                source_id = client.get_source_id(args.repo)
                console.print(f"[green]Found source ID: {source_id}[/green]")

            automation_mode = "AUTO_CREATE_PR" if args.auto_pr else "AUTOMATION_MODE_UNSPECIFIED"
            
            console.print("[blue]Initiating Jules session...[/blue]")
            session = client.create_session(
                prompt=full_prompt,
                title=args.title,
                source_id=source_id,
                starting_branch=args.branch,
                require_plan_approval=args.require_approval,
                automation_mode=automation_mode
            )
            
            session_name = session.get("name")
            session_url = session.get("url")

            console.print(f"[bold green]Session Created![/bold green] ID: {session_name}")
            if session_url:
                console.print(f"Web URL: {session_url}")
            
            if not args.no_poll:
                console.print("[blue]Streaming activities...[/blue]")
                client.poll_session(session_name)
            
        elif args.command == "list-sessions":
            result = client.list_sessions(page_size=args.page_size)
            sessions = result.get("sessions", [])
            
            if not sessions:
                if args.format == "json":
                    print("[]")
                else:
                    console.print("[yellow]No sessions found.[/yellow]")
            else:
                if args.format == "json":
                    print(json.dumps(sessions, indent=2))
                elif args.format == "plain":
                    for session in sessions:
                        name = session.get("name", "")
                        title = session.get("title", "No Title")
                        state = session.get("state", "UNKNOWN")
                        created = session.get("createTime", "")
                        print(f"{name} | {state} | {created} | {title}")
                else:
                    table = Table(title="Sessions")
                    table.add_column("ID", style="cyan")
                    table.add_column("Title", style="white")
                    table.add_column("State", style="green")
                    table.add_column("Created", style="blue")
                    
                    for session in sessions:
                        table.add_row(
                            session.get("name", ""),
                            session.get("title", ""),
                            session.get("state", ""),
                            session.get("createTime", "")
                        )
                    
                    console.print(table)
                
                if "nextPageToken" in result:
                    if args.format == "plain":
                        print(f"More available: use --page-token={result['nextPageToken']}")
                    elif args.format != "json":
                        console.print(f"\n[yellow]More results available. Use --page-token={result['nextPageToken']}[/yellow]")
        
        elif args.command == "get-session":
            session = client.get_session(args.session_id)
            console.print(json.dumps(session, indent=2))
        
        elif args.command == "delete-session":
            client.delete_session(args.session_id)
            console.print(f"[green]Session {args.session_id} deleted successfully.[/green]")
        
        elif args.command == "send-message":
            client.send_message(args.session_id, args.message)
            console.print(f"[green]Message sent to session {args.session_id}[/green]")
        
        elif args.command == "approve-plan":
            client.approve_plan(args.session_id)
            console.print(f"[green]Plan approved for session {args.session_id}[/green]")
        
        elif args.command == "list-activities":
            result = client.list_activities(args.session_id, page_size=args.page_size)
            activities = result.get("activities", [])
            
            if not activities:
                if args.format == "json":
                    print("[]")
                else:
                    console.print("[yellow]No activities found.[/yellow]")
            else:
                if args.format == "json":
                    print(json.dumps(activities, indent=2))
                elif args.format == "plain":
                    for activity in activities:
                        originator = activity.get("originator", "system")
                        description = activity.get("description", "No description")
                        create_time = activity.get("createTime", "")
                        print(f"[{create_time}] {originator.upper()}: {description}")
                else:
                    for activity in activities:
                        originator = activity.get("originator", "system")
                        description = activity.get("description", "No description")
                        create_time = activity.get("createTime", "")
                        
                        color = "green" if originator == "agent" else "blue" if originator == "user" else "white"
                        console.print(f"[{color}][{create_time}] {originator.upper()}: {description}[/{color}]")
        
        elif args.command == "get-activity":
            activity = client.get_activity(args.session_id, args.activity_id)
            console.print(json.dumps(activity, indent=2))
        
        elif args.command == "list-sources":
            result = client.list_sources(page_size=args.page_size, filter_expr=args.filter)
            sources = result.get("sources", [])
            
            if not sources:
                if args.format == "json":
                    print("[]")
                else:
                    console.print("[yellow]No sources found.[/yellow]")
            else:
                if args.format == "json":
                    print(json.dumps(sources, indent=2))
                elif args.format == "plain":
                    for source in sources:
                        github_repo = source.get("githubRepo", {})
                        owner = github_repo.get("owner", "")
                        repo = github_repo.get("repo", "")
                        name = source.get("name", "")
                        is_private = "Private" if github_repo.get("isPrivate", False) else "Public"
                        print(f"{name} | {owner}/{repo} | {is_private}")
                else:
                    table = Table(title="Connected Sources")
                    table.add_column("Name", style="cyan")
                    table.add_column("Owner/Repo", style="white")
                    table.add_column("Default Branch", style="green")
                    table.add_column("Private", style="yellow")
                    
                    for source in sources:
                        github_repo = source.get("githubRepo", {})
                        owner = github_repo.get("owner", "")
                        repo = github_repo.get("repo", "")
                        default_branch = github_repo.get("defaultBranch", {}).get("displayName", "")
                        is_private = "Yes" if github_repo.get("isPrivate", False) else "No"
                        
                        table.add_row(
                            source.get("name", ""),
                            f"{owner}/{repo}",
                            default_branch,
                            is_private
                        )
                    
                    console.print(table)
        
        elif args.command == "get-source":
            source = client.get_source(args.source_id)
            console.print(json.dumps(source, indent=2))

    except KeyboardInterrupt:
        console.print("\n[bold yellow]Operation cancelled by user.[/bold yellow]")
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
CLI wrapper for Jules operations using the new service layer.
This script provides the same interface as the make targets but uses caching and nomenclature.
"""
import argparse
import json
import sys
import os
from typing import Optional

# Add the current directory to the path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from jules_service import JulesService
from jules_nomenclature import JulesNomenclature

def format_session_list(sessions: list, cached: bool = False) -> str:
    """Format sessions for console output."""
    if not sessions:
        return "No sessions found."
    
    output = "Sessions:\n"
    for session in sessions:
        name = session.get('name', '')
        title = session.get('title', 'No Title')
        state = session.get('state', 'UNKNOWN')
        created = session.get('create_time', session.get('createTime', ''))
        archived_mark = "[ARCHIVED] " if session.get('archived') else ""
        
        prompt = session.get('prompt', '')
        if prompt:
            if len(prompt) > 150:
                prompt = prompt[:147] + "..."
            title = f"{title} | {prompt}"
        
        if created:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                created = dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                pass
        
        output += f"  {name} | {archived_mark}{title} | {state} | {created}\n"
    
    if cached:
        output += "\n[Data from cache]"
    
    return output

def format_activity_list(activities: list, cached: bool = False) -> str:
    """Format activities for console output."""
    if not activities:
        return "No activities found."
    
    output = "Activities:\n"
    for activity in activities:
        originator = activity.get('originator', 'SYSTEM')
        description = activity.get('description', 'No description')
        create_time = activity.get('createTime', '')
        
        if create_time:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(create_time.replace('Z', '+00:00'))
                create_time = dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                pass
        
        output += f"  [{create_time}] {originator.upper()}: {description}\n"
    
    if cached:
        output += "\n[Data from cache]"
    
    return output

def format_minimal_session(session: dict) -> dict:
    """Format a session to minimal data for boss agent."""
    from jules_db import JulesDatabase
    
    source_context = session.get('source_context') or session.get('sourceContext')
    parsed_context = JulesDatabase.parse_source_context(source_context)
    
    prompt = session.get('prompt', '')
    if len(prompt) > 150:
        prompt = prompt[:147] + '...'
    
    create_time = session.get('create_time') or session.get('createTime')
    update_time = session.get('update_time') or session.get('updateTime')
    
    return {
        'name': session.get('name'),
        'title': session.get('title'),
        'state': session.get('state'),
        'create_time': JulesDatabase.format_timestamp_human(create_time),
        'update_time': JulesDatabase.format_timestamp_human(update_time or create_time),
        'url': session.get('url'),
        'prompt': prompt,
        'repo_name': parsed_context.get('repo_name'),
        'branch_name': parsed_context.get('branch_name'),
        'archived': session.get('archived', False)
    }

def normalize_session_id(session_id: str) -> str:
    """Strip 'sessions/' prefix if present."""
    if session_id.startswith('sessions/'):
        return session_id[9:]
    return session_id

def main():
    parser = argparse.ArgumentParser(
        description="Jules CLI with caching and nomenclature",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # List sessions command
    list_sessions_parser = subparsers.add_parser("list-sessions", help="List all sessions")
    list_sessions_parser.add_argument("--page-size", type=int, default=10, help="Number of sessions to return")
    list_sessions_parser.add_argument("--filter", help="AIP-160 filter expression")
    list_sessions_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    list_sessions_parser.add_argument("--force-refresh", action="store_true", help="Bypass cache")
    
    # Get session command
    get_session_parser = subparsers.add_parser("get-session", help="Get session details")
    get_session_parser.add_argument("--id", required=True, help="Session ID")
    get_session_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    get_session_parser.add_argument("--force-refresh", action="store_true", help="Bypass cache")
    
    # Delete session command
    delete_session_parser = subparsers.add_parser("delete-session", help="Delete a session")
    delete_session_parser.add_argument("--id", required=True, help="Session ID")

    # Archive session command
    archive_session_parser = subparsers.add_parser("archive-session", help="Archive a session")
    archive_session_parser.add_argument("--id", required=True, help="Session ID")
    
    # Create session command
    create_parser = subparsers.add_parser("create", help="Create a new session")
    create_parser.add_argument("--prompt", required=True, help="Instruction for Jules")
    create_parser.add_argument("--title", help="Optional session title")
    create_parser.add_argument("--repo", help="Repository name (owner/repo)")
    create_parser.add_argument("--branch", default="master", help="Starting branch")
    create_parser.add_argument("--require-approval", action="store_true", help="Require plan approval")
    
    # Send message command
    send_message_parser = subparsers.add_parser("send-message", help="Send a message to a session")
    send_message_parser.add_argument("--id", required=True, help="Session ID")
    send_message_parser.add_argument("--message", required=True, help="Message to send")
    
    # Approve plan command
    approve_plan_parser = subparsers.add_parser("approve-plan", help="Approve a pending plan")
    approve_plan_parser.add_argument("--id", required=True, help="Session ID")
    
    # List activities command
    list_activities_parser = subparsers.add_parser("list-activities", help="List session activities")
    list_activities_parser.add_argument("--id", required=True, help="Session ID")
    list_activities_parser.add_argument("--page-size", type=int, default=10, help="Number of activities to return")
    list_activities_parser.add_argument("--filter", help="AIP-160 filter expression")
    list_activities_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    list_activities_parser.add_argument("--force-refresh", action="store_true", help="Bypass cache")
    
    # List sources command
    list_sources_parser = subparsers.add_parser("list-sources", help="List available sources")
    list_sources_parser.add_argument("--page-size", type=int, default=10, help="Number of sources to return")
    list_sources_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    
    # Show cached sessions command
    show_cached_sessions_parser = subparsers.add_parser("show-cached-sessions", help="Show last 5 sessions from cache (no API call)")
    show_cached_sessions_parser.add_argument("--limit", type=int, default=5, help="Number of sessions to show (default: 5)")
    
    # Fetch latest sessions command
    fetch_latest_parser = subparsers.add_parser("fetch-latest-sessions", help="Fetch and return only new/updated sessions")
    fetch_latest_parser.add_argument("--limit", type=int, default=50, help="Maximum sessions to fetch")
    fetch_latest_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    
    # Get session status command
    status_parser = subparsers.add_parser("get-session-status", help="Get current session state and recent activities")
    status_parser.add_argument("--id", required=True, help="Session ID")
    status_parser.add_argument("--activities", type=int, default=3, help="Number of recent activities to include")
    status_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    
    # Get pending feedback command
    feedback_parser = subparsers.add_parser("get-pending-feedback", help="Get last agent message for session awaiting feedback")
    feedback_parser.add_argument("--id", required=True, help="Session ID")
    feedback_parser.add_argument("--format", choices=["plain", "json"], default="plain", help="Output format")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        service = JulesService()
        
        if args.command == "create" and args.repo:
            nom = JulesNomenclature()
            nom.load_catalog()
            resolution = nom.resolve_repo_name(args.repo)

            if resolution["exact"]:
                args.repo = resolution["exact"]["name"]
            elif resolution["candidates"]:
                candidate_names = [c['name'] for c in resolution["candidates"]]
                print(f"Error: Repository '{args.repo}' not found. Did you mean one of these?\n - " + "\n - ".join(candidate_names), file=sys.stderr)
                sys.exit(1)
            else:
                print(f"Error: Repository '{args.repo}' not found and no close matches discovered.", file=sys.stderr)
                sys.exit(1)

        if args.command == "list-sessions":
            result = service.list_sessions(
                page_size=args.page_size,
                filter_expr=args.filter,
                force_refresh=args.force_refresh
            )
            sessions = result.get('sessions', [])
            cached = result.get('cached', False)
            
            if args.format == "json":
                print(json.dumps(sessions, indent=2))
            else:
                print(format_session_list(sessions, cached))
        
        elif args.command == "get-session":
            session = service.get_session(
                session_id=normalize_session_id(args.id),
                force_refresh=args.force_refresh
            )
            
            if not session:
                print(f"Session {args.id} not found.")
                return
            
            if args.format == "json":
                print(json.dumps(session, indent=2))
            else:
                print(json.dumps(session, indent=2))
        
        elif args.command == "delete-session":
            success = service.delete_session(normalize_session_id(args.id))
            if success:
                print(f"Session {args.id} deleted successfully.")
            else:
                print(f"Failed to delete session {args.id}.")

        elif args.command == "archive-session":
            success = service.archive_session(normalize_session_id(args.id))
            if success:
                print(f"Session {args.id} archived successfully.")
            else:
                print(f"Failed to archive session {args.id}.")
        
        elif args.command == "create":
            session = service.create_session(
                prompt=args.prompt,
                title=args.title,
                repo=args.repo,
                branch=args.branch,
                require_plan_approval=args.require_approval
            )
            
            session_id = session.get('name', '')
            session_url = session.get('url', '')
            
            print(f"Session Created! ID: {session_id}")
            if session_url:
                print(f"Web URL: {session_url}")
        
        elif args.command == "send-message":
            response = service.send_message(normalize_session_id(args.id), args.message)
            print(f"Message sent to session {args.id}")
        
        elif args.command == "approve-plan":
            response = service.approve_plan(normalize_session_id(args.id))
            print(f"Plan approved for session {args.id}")
        
        elif args.command == "list-activities":
            result = service.list_activities(
                session_id=normalize_session_id(args.id),
                page_size=args.page_size,
                filter_expr=args.filter,
                force_refresh=args.force_refresh
            )
            activities = result.get('activities', [])
            cached = result.get('cached', False)
            
            if args.format == "json":
                print(json.dumps(activities, indent=2))
            else:
                print(format_activity_list(activities, cached))
        
        elif args.command == "list-sources":
            result = service.list_sources(page_size=args.page_size)
            sources = result.get('sources', [])
            
            if args.format == "json":
                print(json.dumps(sources, indent=2))
            else:
                if not sources:
                    print("No sources found.")
                else:
                    print("Connected Sources:")
                    for source in sources:
                        github_repo = source.get("githubRepo", {})
                        owner = github_repo.get("owner", "")
                        repo = github_repo.get("repo", "")
                        name = source.get("name", "")
                        print(f"  {name} | {owner}/{repo}")
        
        elif args.command == "fetch-latest-sessions":
            result = service.fetch_latest_sessions(limit=args.limit)
            new_sessions = result.get('new_sessions', [])
            updated_sessions = result.get('updated_sessions', [])
            total_fetched = result.get('total_fetched', 0)
            
            formatted_new = [format_minimal_session(s) for s in new_sessions]
            formatted_updated = [format_minimal_session(s) for s in updated_sessions]
            
            output = {
                'new_sessions': formatted_new,
                'updated_sessions': formatted_updated,
                'total_fetched': total_fetched,
                'new_count': len(new_sessions),
                'updated_count': len(updated_sessions)
            }
            
            if args.format == "json":
                print(json.dumps(output, indent=2))
            else:
                print(f"Fetched {total_fetched} sessions from API")
                print(f"New sessions: {len(new_sessions)}")
                print(f"Updated sessions: {len(updated_sessions)}")
                if formatted_new:
                    print("\nNew sessions:")
                    for session in formatted_new:
                        repo_branch = f"{session['repo_name']}:{session['branch_name']}" if session['repo_name'] and session['branch_name'] else "N/A"
                        print(f"  {session['name']} | {repo_branch} | {session['title']} ({session['state']}) | {session['create_time']}")
                if formatted_updated:
                    print("\nUpdated sessions:")
                    for session in formatted_updated:
                        repo_branch = f"{session['repo_name']}:{session['branch_name']}" if session['repo_name'] and session['branch_name'] else "N/A"
                        print(f"  {session['name']} | {repo_branch} | {session['title']} ({session['state']}) | {session['create_time']}")
        
        elif args.command == "get-session-status":
            result = service.get_session_status(normalize_session_id(args.id), include_activities=args.activities)
            
            if args.format == "json":
                print(json.dumps(result, indent=2))
            elif "error" in result:
                print(f"Error: {result['error']}")
            else:
                from jules_db import JulesDatabase
                update_time = JulesDatabase.format_timestamp_human(result.get('update_time'))
                
                print(f"Session: {result.get('title', 'Unknown')} ({result.get('session_id')})")
                print(f"Status: {result.get('state', 'UNKNOWN')}")
                print(f"Last updated: {update_time}")
                
                activities = result.get('recent_activities', [])
                if activities:
                    print(f"\nRecent activities ({len(activities)}):")
                    for act in activities:
                        act_time = JulesDatabase.format_timestamp_human(act.get('time'))
                        act_type = act.get('type', 'unknown').replace('_', ' ').title()
                        content = act.get('content', '')
                        
                        if len(content) > 150:
                            content = content[:147] + "..."
                            
                        print(f"  [{act_time}] {act_type}: {content}")
        
        elif args.command == "get-pending-feedback":
            result = service.get_pending_feedback(normalize_session_id(args.id))
            
            if args.format == "json":
                print(json.dumps(result, indent=2))
            elif "error" in result:
                print(f"Error: {result['error']}")
            else:
                from jules_db import JulesDatabase
                msg_time = JulesDatabase.format_timestamp_human(result.get('message_time'))
                
                print(f"Session: {result.get('title', 'Unknown')} ({result.get('session_id')})")
                print(f"Awaiting feedback since: {msg_time}")
                print("-" * 40)
                print(result.get('last_agent_message', 'No message content'))
                print("-" * 40)
                print(f"Use 'make jules-send-message ID={args.id} MESSAGE=\"your reply\"' to respond.")
        
        elif args.command == "show-cached-sessions":
            from jules_db import JulesDatabase
            db = JulesDatabase()
            sessions = db.list_sessions(limit=args.limit)
            
            if not sessions:
                print("No cached sessions found.")
                return
            
            print("Cached Sessions:")
            for session in sessions:
                name = session.get('name', '')
                title = session.get('title', 'No Title')
                state = session.get('state', 'UNKNOWN')
                update_time = session.get('update_time', session.get('create_time', ''))
                
                source_context = session.get('source_context')
                repo_info = JulesDatabase.parse_source_context(source_context)
                repo_name = repo_info['repo_name'] or 'Unknown'
                branch_name = repo_info['branch_name'] or 'Unknown'
                
                formatted_time = JulesDatabase.format_timestamp_human(update_time)
                
                if len(title) > 50:
                    title = title[:47] + "..."
                
                print(f"- {name} | {repo_name}:{branch_name} | {state} | {title} | {formatted_time}")
    
    except Exception as e:
        error_msg = str(e)
        if "sessions/" in error_msg:
             error_msg = "A session operation failed. Please check the session ID and try again."
        print(f"Error: {error_msg}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

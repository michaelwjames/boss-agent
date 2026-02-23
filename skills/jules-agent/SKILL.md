# Jules Terminal Client

## Description

A comprehensive terminal interface for the Google Jules API. This skill provides complete access to all Jules API capabilities including session management, activity monitoring, source repository management, and interactive messaging. It supports both "repoless" ephemeral environments and repository-connected workflows with full CRUD operations and real-time activity streaming.

## API Capabilities

### Sessions
- **Create Session**: Start new coding tasks in repoless or repository mode
- **List Sessions**: View all sessions with pagination support
- **Get Session**: Retrieve detailed session information including outputs
- **Delete Session**: Remove sessions from your account
- **Send Message**: Provide feedback or additional instructions to active sessions
- **Approve Plan**: Explicitly approve generated plans when required

### Activities
- **List Activities**: Monitor all activities for a session with pagination
- **Get Activity**: Retrieve detailed information about specific activities
- **Real-time Polling**: Stream activity updates as they occur

### Sources
- **List Sources**: View all connected GitHub repositories
- **Get Source**: Retrieve detailed source information including branches
- **Filter Sources**: Use filter expressions to find specific repositories

## Command Reference

### Create Session
```bash
python jules_client.py create --prompt "TASK_DESCRIPTION" [OPTIONS]
```

**Options:**
- `--prompt`: (Required) Task description for Jules
- `--title`: Optional session title
- `--repo`: Repository name (owner/repo format)
- `--branch`: Starting branch (default: main)
- `--context-file`: Path to file with additional context
- `--require-approval`: Require explicit plan approval
- `--auto-pr`: Automatically create pull requests
- `--no-poll`: Create session without polling for updates
- `--plain`: Output plain text (recommended for Boss Agent)
- `--timeout`: Max polling time in seconds (default: 300)

### List Sessions
```bash
python jules_client.py list-sessions [--page-size N]
```

### Get Session Details
```bash
python jules_client.py get-session --session-id SESSION_ID
```

### Delete Session
```bash
python jules_client.py delete-session --session-id SESSION_ID
```

### Send Message to Session
```bash
python jules_client.py send-message --session-id SESSION_ID --message "MESSAGE"
```

### Approve Plan
```bash
python jules_client.py approve-plan --session-id SESSION_ID
```

### List Activities
```bash
python jules_client.py list-activities --session-id SESSION_ID [--page-size N]
```

### Get Activity Details
```bash
python jules_client.py get-activity --session-id SESSION_ID --activity-id ACTIVITY_ID
```

### List Sources
```bash
python jules_client.py list-sources [--page-size N] [--filter "EXPRESSION"]
```

### Get Source Details
```bash
python jules_client.py get-source --source-id SOURCE_ID
```

## Configuration

### Environment Variables
- `JULES_API_KEY`: Your Jules API key (get from https://jules.google.com/settings)

Alternatively, pass `--api-key` flag to any command.

## Session States

Sessions progress through these states:
- `QUEUED`: Session is queued for processing
- `PLANNING`: Jules is creating a plan
- `AWAITING_PLAN_APPROVAL`: Plan requires user approval
- `AWAITING_USER_FEEDBACK`: Jules needs additional input
- `IN_PROGRESS`: Actively executing the task
- `PAUSED`: Session is paused
- `COMPLETED`: Successfully completed
- `FAILED`: Encountered an error

## Activity Types

Activities represent events within a session:
- **Plan Generated**: Jules created an execution plan
- **Plan Approved**: Plan was approved (manually or automatically)
- **User Messaged**: User sent a message
- **Agent Messaged**: Jules sent a message or question
- **Progress Updated**: Status update during execution
- **Session Completed**: Task finished successfully
- **Session Failed**: Task encountered an error

## Artifacts

Activities may include artifacts:
- **ChangeSet**: Code changes with git patches
- **BashOutput**: Command execution results
- **Media**: Screenshots or images

## Outputs

Completed sessions may include:
- **Pull Requests**: URLs to created PRs (when using AUTO_CREATE_PR mode)
- **File Changes**: Modified files and diffs
- **Execution Logs**: Command outputs and test results

## Basic Usage Examples

```bash
# Create a repoless session
python jules_client.py create --prompt "Build a FastAPI server with one endpoint"

# Create a session with repository
python jules_client.py create --prompt "Add unit tests for auth module" --repo myorg/myrepo --branch develop

# Create session with plan approval required
python jules_client.py create --prompt "Refactor database layer" --repo myorg/myrepo --require-approval

# List all sessions
python jules_client.py list-sessions

# Get session details
python jules_client.py get-session --session-id 1234567

# Send follow-up message
python jules_client.py send-message --session-id 1234567 --message "Also add integration tests"

# Approve a pending plan
python jules_client.py approve-plan --session-id 1234567

# View session activities
python jules_client.py list-activities --session-id 1234567

# List connected repositories
python jules_client.py list-sources
```

## Advanced Features

### Pagination
All list commands support pagination:
```bash
python jules_client.py list-sessions --page-size 50
```

### Filtering Sources
Filter repositories using AIP-160 expressions:
```bash
python jules_client.py list-sources --filter "name=sources/github-myorg-myrepo"
```

### Context Files
Include additional context from files:
```bash
python jules_client.py create --prompt "Fix the bug" --context-file bug_report.txt --repo myorg/myrepo
```

### Automation Modes
- `AUTOMATION_MODE_UNSPECIFIED`: Default behavior
- `AUTO_CREATE_PR`: Automatically create pull requests when code is ready

```bash
python jules_client.py create --prompt "Add feature" --repo myorg/myrepo --auto-pr
```

## Error Handling

The client provides detailed error messages for:
- Authentication failures (invalid API key)
- Missing repositories (not connected to Jules)
- Invalid session states
- Network errors
- API rate limits

All errors include HTTP status codes and detailed messages from the API.

## Python API Usage

The `JulesClient` class can also be used programmatically:

```python
from jules_client import JulesClient

client = JulesClient(api_key="your-api-key")

# Create a session
session = client.create_session(
    prompt="Build a REST API",
    title="API Development",
    require_plan_approval=True
)

# List sessions
sessions = client.list_sessions(page_size=10)

# Send a message
client.send_message(session_id="1234567", message="Add authentication")

# Approve plan
client.approve_plan(session_id="1234567")
```

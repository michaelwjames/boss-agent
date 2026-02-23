# Jules Client Examples

This document provides comprehensive examples of using the Jules Terminal Client to interact with the Google Jules API.

## Table of Contents

- [Setup](#setup)
- [Session Management](#session-management)
- [Activity Monitoring](#activity-monitoring)
- [Source Management](#source-management)
- [Interactive Workflows](#interactive-workflows)
- [Advanced Usage](#advanced-usage)
- [Python API Examples](#python-api-examples)

## Setup

### Environment Configuration

Create a `.env` file in your project directory:

```bash
JULES_API_KEY=your_api_key_here
```

Or export the environment variable:

```bash
export JULES_API_KEY="your_api_key_here"
```

Get your API key from: https://jules.google.com/settings

### Installation

```bash
pip install -r requirements.txt
```

## Session Management

### Creating Sessions

#### 1. Repoless Session (Ephemeral Environment)

Create a standalone session without a repository:

```bash
python jules_client.py create \
  --prompt "Create a Snake game in Python using pygame"
```

This creates an ephemeral environment where Jules can write code from scratch.

#### 2. Repository-Connected Session

Work with an existing GitHub repository:

```bash
python jules_client.py create \
  --prompt "Add comprehensive unit tests for the authentication module" \
  --repo myorg/myrepo \
  --branch develop
```

#### 3. Session with Custom Title

```bash
python jules_client.py create \
  --prompt "Refactor the database layer to use async/await" \
  --title "Database Async Refactor" \
  --repo myorg/myrepo
```

#### 4. Session with Plan Approval Required

For critical changes, require manual plan approval:

```bash
python jules_client.py create \
  --prompt "Migrate from PostgreSQL to MongoDB" \
  --repo myorg/myrepo \
  --require-approval
```

Jules will generate a plan and wait for your approval before executing.

#### 5. Session with Auto PR Creation

Automatically create a pull request when code is ready:

```bash
python jules_client.py create \
  --prompt "Add dark mode support to the UI" \
  --repo myorg/myrepo \
  --auto-pr
```

#### 6. Session with Context File

Include additional context from a file:

```bash
python jules_client.py create \
  --prompt "Fix the bug described in the report" \
  --context-file bug_report.txt \
  --repo myorg/myrepo
```

The content of `bug_report.txt` will be appended to the prompt.

#### 7. Create Session Without Polling

Create a session but don't wait for completion:

```bash
python jules_client.py create \
  --prompt "Add logging to all API endpoints" \
  --repo myorg/myrepo \
  --no-poll
```

You can check the session status later using `get-session`.

### Listing Sessions

#### Basic List

```bash
python jules_client.py list-sessions
```

Output:
```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ID                 ┃ Title              ┃ State     ┃ Created                ┃
┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━┩
│ sessions/1234567   │ Add auth tests     │ COMPLETED │ 2024-01-15T10:30:00Z   │
│ sessions/1234568   │ Database Refactor  │ IN_PROGRESS│ 2024-01-15T11:00:00Z  │
└────────────────────┴────────────────────┴───────────┴────────────────────────┘
```

#### List with Custom Page Size

```bash
python jules_client.py list-sessions --page-size 50
```

### Getting Session Details

Retrieve full details about a specific session:

```bash
python jules_client.py get-session --session-id 1234567
```

Output includes:
- Session state
- Prompt and title
- Source context (if applicable)
- Outputs (PRs, file changes)
- Timestamps

Example output:
```json
{
  "name": "sessions/1234567",
  "id": "abc123",
  "prompt": "Add comprehensive unit tests for the authentication module",
  "title": "Add auth tests",
  "state": "COMPLETED",
  "url": "https://jules.google.com/session/abc123",
  "createTime": "2024-01-15T10:30:00Z",
  "updateTime": "2024-01-15T11:45:00Z",
  "outputs": [
    {
      "pullRequest": {
        "url": "https://github.com/myorg/myrepo/pull/42",
        "title": "Add auth tests",
        "description": "Added unit tests for authentication module"
      }
    }
  ]
}
```

### Deleting Sessions

Remove a session from your account:

```bash
python jules_client.py delete-session --session-id 1234567
```

## Activity Monitoring

### Listing Activities

View all activities for a session:

```bash
python jules_client.py list-activities --session-id 1234567
```

Output shows chronological events:
```
[2024-01-15T10:30:00Z] SYSTEM: Session started
[2024-01-15T10:31:00Z] AGENT: Plan generated
[2024-01-15T10:32:00Z] AGENT: Plan approved
[2024-01-15T10:35:00Z] AGENT: Writing tests for login functionality
[2024-01-15T10:40:00Z] AGENT: Running test suite
[2024-01-15T11:45:00Z] SYSTEM: Session completed
```

### List Activities with Pagination

```bash
python jules_client.py list-activities --session-id 1234567 --page-size 100
```

### Getting Activity Details

Retrieve detailed information about a specific activity:

```bash
python jules_client.py get-activity --session-id 1234567 --activity-id act123
```

This returns full activity data including:
- Activity type (plan generated, progress update, etc.)
- Artifacts (code changes, bash output, media)
- Timestamps
- Originator (user, agent, system)

Example output with code changes:
```json
{
  "name": "sessions/1234567/activities/act123",
  "id": "act123",
  "originator": "agent",
  "description": "Added authentication tests",
  "createTime": "2024-01-15T10:35:00Z",
  "artifacts": [
    {
      "changeSet": {
        "source": "sources/github-myorg-myrepo",
        "gitPatch": {
          "baseCommitId": "a1b2c3d4e5f6",
          "unidiffPatch": "diff --git a/tests/test_auth.py b/tests/test_auth.py\n...",
          "suggestedCommitMessage": "Add authentication tests"
        }
      }
    }
  ]
}
```

## Source Management

### Listing Sources

View all connected GitHub repositories:

```bash
python jules_client.py list-sources
```

Output:
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━┓
┃ Name                          ┃ Owner/Repo     ┃ Default Branch┃ Private ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━┩
│ sources/github-myorg-myrepo   │ myorg/myrepo   │ main         │ No      │
│ sources/github-myorg-private  │ myorg/private  │ develop      │ Yes     │
└───────────────────────────────┴────────────────┴──────────────┴─────────┘
```

### List Sources with Pagination

```bash
python jules_client.py list-sources --page-size 50
```

### Filter Sources

Find specific repositories using filter expressions:

```bash
# Get a specific source
python jules_client.py list-sources \
  --filter "name=sources/github-myorg-myrepo"

# Get multiple sources
python jules_client.py list-sources \
  --filter "name=sources/source1 OR name=sources/source2"
```

### Getting Source Details

Retrieve detailed information including all branches:

```bash
python jules_client.py get-source --source-id github-myorg-myrepo
```

Output includes:
- Repository owner and name
- Default branch
- All available branches
- Privacy status

Example output:
```json
{
  "name": "sources/github-myorg-myrepo",
  "id": "github-myorg-myrepo",
  "githubRepo": {
    "owner": "myorg",
    "repo": "myrepo",
    "isPrivate": false,
    "defaultBranch": {
      "displayName": "main"
    },
    "branches": [
      {"displayName": "main"},
      {"displayName": "develop"},
      {"displayName": "feature/auth"},
      {"displayName": "feature/ui-redesign"}
    ]
  }
}
```

## Interactive Workflows

### Workflow 1: Create Session with Plan Approval

```bash
# Step 1: Create session requiring approval
python jules_client.py create \
  --prompt "Refactor the payment processing module" \
  --repo myorg/myrepo \
  --require-approval

# Jules will generate a plan and wait
# Session state: AWAITING_PLAN_APPROVAL

# Step 2: Review the plan (check activities or web UI)
python jules_client.py list-activities --session-id 1234567

# Step 3: Approve the plan
python jules_client.py approve-plan --session-id 1234567

# Jules will now execute the plan
```

### Workflow 2: Interactive Session with Messages

```bash
# Step 1: Create initial session
python jules_client.py create \
  --prompt "Add user authentication" \
  --repo myorg/myrepo \
  --no-poll

# Step 2: Monitor progress
python jules_client.py list-activities --session-id 1234567

# Step 3: Send additional instructions
python jules_client.py send-message \
  --session-id 1234567 \
  --message "Please also add OAuth2 support with Google and GitHub providers"

# Step 4: Send follow-up
python jules_client.py send-message \
  --session-id 1234567 \
  --message "Add rate limiting to the login endpoint"

# Step 5: Check final status
python jules_client.py get-session --session-id 1234567
```

### Workflow 3: Multi-Branch Development

```bash
# Work on feature branch
python jules_client.py create \
  --prompt "Implement new dashboard UI" \
  --repo myorg/myrepo \
  --branch feature/dashboard \
  --auto-pr

# Work on different branch
python jules_client.py create \
  --prompt "Add API documentation" \
  --repo myorg/myrepo \
  --branch feature/docs \
  --auto-pr
```

### Workflow 4: Bug Fix with Context

```bash
# Create bug report file
cat > bug_report.txt << EOF
Bug: Login fails when username contains special characters

Steps to Reproduce:
1. Navigate to /login
2. Enter username: user@example.com
3. Enter password
4. Click submit

Expected: Successful login
Actual: 500 Internal Server Error

Stack trace:
  File "auth.py", line 42, in validate_username
    if not re.match(r'^[a-zA-Z0-9]+$', username):
      ...
EOF

# Create session with context
python jules_client.py create \
  --prompt "Fix the login bug" \
  --context-file bug_report.txt \
  --repo myorg/myrepo \
  --branch bugfix/login-special-chars
```

## Advanced Usage

### Pagination Through All Sessions

```bash
# Get first page
python jules_client.py list-sessions --page-size 10 > page1.json

# Extract next page token from response
# Then get next page (would need to add --page-token support)
```

### Monitoring Long-Running Sessions

```bash
# Create session without polling
python jules_client.py create \
  --prompt "Migrate entire codebase to TypeScript" \
  --repo myorg/myrepo \
  --no-poll

# Periodically check status
watch -n 30 'python jules_client.py get-session --session-id 1234567'

# Or monitor activities
watch -n 10 'python jules_client.py list-activities --session-id 1234567'
```

### Batch Operations

```bash
#!/bin/bash
# Create multiple sessions for different tasks

TASKS=(
  "Add unit tests for user module"
  "Add unit tests for product module"
  "Add unit tests for order module"
)

for task in "${TASKS[@]}"; do
  python jules_client.py create \
    --prompt "$task" \
    --repo myorg/myrepo \
    --no-poll
  sleep 2
done

# List all sessions
python jules_client.py list-sessions
```

## Python API Examples

### Basic Usage

```python
from jules_client import JulesClient
import os

# Initialize client
api_key = os.getenv("JULES_API_KEY")
client = JulesClient(api_key)

# Create a repoless session
session = client.create_session(
    prompt="Build a REST API for a todo app using FastAPI"
)

print(f"Session created: {session['name']}")
print(f"Web URL: {session['url']}")
```

### Repository Session with Options

```python
from jules_client import JulesClient

client = JulesClient(api_key="your-api-key")

# Create session with all options
session = client.create_session(
    prompt="Add comprehensive error handling to the API",
    title="API Error Handling",
    source_id="sources/github-myorg-myrepo",
    starting_branch="develop",
    require_plan_approval=True,
    automation_mode="AUTO_CREATE_PR"
)

session_id = session["name"].split("/")[1]
print(f"Session ID: {session_id}")
```

### Interactive Session Management

```python
from jules_client import JulesClient
import time

client = JulesClient(api_key="your-api-key")

# Create session
session = client.create_session(
    prompt="Implement user authentication",
    source_id="sources/github-myorg-myrepo"
)

session_id = session["name"].split("/")[1]

# Wait a bit for plan generation
time.sleep(10)

# Send additional message
client.send_message(
    session_id=session_id,
    message="Please use JWT tokens for authentication"
)

# Monitor activities
activities = client.list_activities(session_id=session_id)
for activity in activities["activities"]:
    print(f"{activity['originator']}: {activity['description']}")
```

### Source Discovery

```python
from jules_client import JulesClient

client = JulesClient(api_key="your-api-key")

# List all sources
sources_data = client.list_sources(page_size=50)
sources = sources_data["sources"]

# Find a specific repo
for source in sources:
    github_repo = source.get("githubRepo", {})
    owner = github_repo.get("owner")
    repo = github_repo.get("repo")
    
    if owner == "myorg" and repo == "myrepo":
        print(f"Found source: {source['name']}")
        
        # Get detailed info including branches
        details = client.get_source(source["id"])
        branches = details["githubRepo"]["branches"]
        
        print("Available branches:")
        for branch in branches:
            print(f"  - {branch['displayName']}")
```

### Error Handling

```python
from jules_client import JulesClient
import requests

client = JulesClient(api_key="your-api-key")

try:
    session = client.create_session(
        prompt="Add tests",
        source_id="sources/nonexistent-repo"
    )
except requests.exceptions.HTTPError as e:
    print(f"HTTP Error: {e}")
    print(f"Status Code: {e.response.status_code}")
    print(f"Response: {e.response.content.decode()}")
except ValueError as e:
    print(f"Validation Error: {e}")
```

### Pagination Example

```python
from jules_client import JulesClient

client = JulesClient(api_key="your-api-key")

# Get all sessions using pagination
all_sessions = []
page_token = None

while True:
    result = client.list_sessions(page_size=30, page_token=page_token)
    all_sessions.extend(result.get("sessions", []))
    
    page_token = result.get("nextPageToken")
    if not page_token:
        break

print(f"Total sessions: {len(all_sessions)}")
```

### Activity Monitoring with Filtering

```python
from jules_client import JulesClient
import time

client = JulesClient(api_key="your-api-key")

session_id = "1234567"
last_timestamp = None

# Poll for new activities
while True:
    result = client.list_activities(
        session_id=session_id,
        page_size=50,
        create_time=last_timestamp
    )
    
    activities = result.get("activities", [])
    
    for activity in activities:
        print(f"{activity['createTime']}: {activity['description']}")
        
        # Check for artifacts
        if "artifacts" in activity:
            for artifact in activity["artifacts"]:
                if "changeSet" in artifact:
                    print("  Code changes detected!")
                elif "bashOutput" in artifact:
                    print(f"  Command output: {artifact['bashOutput']['output']}")
    
    if activities:
        last_timestamp = activities[-1]["createTime"]
    
    # Check session state
    session = client.get_session(session_id)
    if session["state"] in ["COMPLETED", "FAILED"]:
        print(f"Session finished: {session['state']}")
        break
    
    time.sleep(5)
```

### Workflow Automation

```python
from jules_client import JulesClient
import time

def create_and_monitor_session(client, prompt, repo, branch="main"):
    """Create a session and monitor until completion."""
    
    # Create session
    session = client.create_session(
        prompt=prompt,
        source_id=f"sources/github-{repo.replace('/', '-')}",
        starting_branch=branch,
        automation_mode="AUTO_CREATE_PR"
    )
    
    session_id = session["name"].split("/")[1]
    print(f"Created session {session_id}")
    
    # Monitor until completion
    while True:
        session_data = client.get_session(session_id)
        state = session_data["state"]
        
        print(f"Status: {state}")
        
        if state in ["COMPLETED", "FAILED"]:
            # Get outputs
            outputs = session_data.get("outputs", [])
            for output in outputs:
                if "pullRequest" in output:
                    pr_url = output["pullRequest"]["url"]
                    print(f"Pull Request: {pr_url}")
            
            return session_data
        
        time.sleep(10)

# Usage
client = JulesClient(api_key="your-api-key")

result = create_and_monitor_session(
    client,
    prompt="Add logging to all API endpoints",
    repo="myorg/myrepo",
    branch="develop"
)
```

## Tips and Best Practices

1. **Use Plan Approval for Critical Changes**: Always use `--require-approval` for database migrations, security changes, or major refactors.

2. **Leverage Context Files**: For complex bugs or features, create detailed context files to give Jules all necessary information.

3. **Monitor Long Sessions**: For large tasks, use `--no-poll` and check status periodically rather than keeping a connection open.

4. **Use Descriptive Titles**: Custom titles help organize and find sessions later.

5. **Specify Branches**: Always specify the target branch for repository sessions to avoid working on the wrong branch.

6. **Auto-PR for Automation**: Use `--auto-pr` when integrating Jules into CI/CD pipelines.

7. **Check Sources First**: Run `list-sources` to verify repository connections before creating sessions.

8. **Pagination for Large Lists**: Use appropriate page sizes when listing many sessions or activities.

9. **Error Handling**: Always wrap API calls in try-catch blocks when using the Python API.

10. **Activity Monitoring**: Use `list-activities` to understand what Jules is doing and debug issues.

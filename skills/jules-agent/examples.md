# Jules Client Examples

This document provides comprehensive examples of using the Jules Terminal Client to interact with the Google Jules API.

## Table of Contents

- [Setup](#setup)
- [Session Management](#session-management)
- [Activity Monitoring](#activity-monitoring)
- [Source Management](#source-management)
- [Interactive Workflows](#interactive-workflows)
- [Advanced Usage](#advanced-usage)
- [TypeScript API Examples](#typescript-api-examples)

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
pnpm add axios commander chalk ora cli-table3
```

## Session Management

### Creating Sessions

#### 1. Repoless Session (Ephemeral Environment)

Create a standalone session without a repository:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Create a Snake game in Python using pygame"
```

This creates an ephemeral environment where Jules can write code from scratch.

#### 2. Repository-Connected Session

Work with an existing GitHub repository:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Add comprehensive unit tests for the authentication module" \
  --repo myorg/myrepo \
  --branch develop
```

#### 3. Session with Custom Title

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Refactor the database layer to use async/await" \
  --title "Database Async Refactor" \
  --repo myorg/myrepo
```

#### 4. Session with Plan Approval Required

For critical changes, require manual plan approval:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Migrate from PostgreSQL to MongoDB" \
  --repo myorg/myrepo \
  --require-approval
```

Jules will generate a plan and wait for your approval before executing.

#### 5. Session with Auto PR Creation

Automatically create a pull request when code is ready:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Add dark mode support to the UI" \
  --repo myorg/myrepo \
  --auto-pr
```

#### 6. Session with Context File

Include additional context from a file:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Fix the bug described in the report" \
  --context-file bug_report.txt \
  --repo myorg/myrepo
```

The content of `bug_report.txt` will be appended to the prompt.

#### 7. Create Session Without Polling

Create a session but don't wait for completion:

```bash
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Add logging to all API endpoints" \
  --repo myorg/myrepo \
  --no-poll
```

You can check the session status later using `get-session`.

### Listing Sessions

#### Basic List

```bash
npx tsx skills/jules-agent/jules_client.ts list-sessions
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
npx tsx skills/jules-agent/jules_client.ts list-sessions --page-size 50
```

### Getting Session Details

Retrieve full details about a specific session:

```bash
npx tsx skills/jules-agent/jules_client.ts get-session --session-id 1234567
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
npx tsx skills/jules-agent/jules_client.ts delete-session --session-id 1234567
```

## Activity Monitoring

### Listing Activities

View all activities for a session:

```bash
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567
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
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567 --page-size 100
```

### Getting Activity Details

Retrieve detailed information about a specific activity:

```bash
npx tsx skills/jules-agent/jules_client.ts get-activity --session-id 1234567 --activity-id act123
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
npx tsx skills/jules-agent/jules_client.ts list-sources
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
npx tsx skills/jules-agent/jules_client.ts list-sources --page-size 50
```

### Filter Sources

Find specific repositories using filter expressions:

```bash
# Get a specific source
npx tsx skills/jules-agent/jules_client.ts list-sources \
  --filter "name=sources/github-myorg-myrepo"

# Get multiple sources
npx tsx skills/jules-agent/jules_client.ts list-sources \
  --filter "name=sources/source1 OR name=sources/source2"
```

### Getting Source Details

Retrieve detailed information including all branches:

```bash
npx tsx skills/jules-agent/jules_client.ts get-source --source-id github-myorg-myrepo
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
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Refactor the payment processing module" \
  --repo myorg/myrepo \
  --require-approval

# Jules will generate a plan and wait
# Session state: AWAITING_PLAN_APPROVAL

# Step 2: Review the plan (check activities or web UI)
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567

# Step 3: Approve the plan
npx tsx skills/jules-agent/jules_client.ts approve-plan --session-id 1234567

# Jules will now execute the plan
```

### Workflow 2: Interactive Session with Messages

```bash
# Step 1: Create initial session
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Add user authentication" \
  --repo myorg/myrepo \
  --no-poll

# Step 2: Monitor progress
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567

# Step 3: Send additional instructions
npx tsx skills/jules-agent/jules_client.ts send-message \
  --session-id 1234567 \
  --message "Please also add OAuth2 support with Google and GitHub providers"

# Step 4: Send follow-up
npx tsx skills/jules-agent/jules_client.ts send-message \
  --session-id 1234567 \
  --message "Add rate limiting to the login endpoint"

# Step 5: Check final status
npx tsx skills/jules-agent/jules_client.ts get-session --session-id 1234567
```

### Workflow 3: Multi-Branch Development

```bash
# Work on feature branch
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Implement new dashboard UI" \
  --repo myorg/myrepo \
  --branch feature/dashboard \
  --auto-pr

# Work on different branch
npx tsx skills/jules-agent/jules_client.ts create \
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
npx tsx skills/jules-agent/jules_client.ts create \
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
npx tsx skills/jules-agent/jules_client.ts create \
  --prompt "Migrate entire codebase to TypeScript" \
  --repo myorg/myrepo \
  --no-poll

# Periodically check status
watch -n 30 'npx tsx skills/jules-agent/jules_client.ts get-session --session-id 1234567'

# Or monitor activities
watch -n 10 'npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567'
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
  npx tsx skills/jules-agent/jules_client.ts create \
    --prompt "$task" \
    --repo myorg/myrepo \
    --no-poll
  sleep 2
done

# List all sessions
npx tsx skills/jules-agent/jules_client.ts list-sessions
```

## TypeScript API Examples

### Basic Usage

```typescript
import { JulesClient } from './jules_client';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize client
const apiKey = process.env.JULES_API_KEY!;
const client = new JulesClient(apiKey);

// Create a repoless session
const session = await client.createSession({
    prompt: "Build a REST API for a todo app using FastAPI"
});

console.log(`Session created: ${session.name}`);
console.log(`Web URL: ${session.url}`);
```

### Repository Session with Options

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

// Create session with all options
const session = await client.createSession({
    prompt: "Add comprehensive error handling to the API",
    title: "API Error Handling",
    sourceId: "sources/github-myorg-myrepo",
    startingBranch: "develop",
    requirePlanApproval: true,
    automationMode: "AUTO_CREATE_PR"
});

const sessionId = session.name.split("/")[1];
console.log(`Session ID: ${sessionId}`);
```

### Interactive Session Management

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

// Create session
const session = await client.createSession({
    prompt: "Implement user authentication",
    sourceId: "sources/github-myorg-myrepo"
});

const sessionId = session.name.split("/")[1];

// Wait a bit for plan generation
await new Promise(resolve => setTimeout(resolve, 10000));

// Send additional message
await client.sendMessage(sessionId, "Please use JWT tokens for authentication");

// Monitor activities
const activities = await client.listActivities(sessionId);
for (const activity of activities.activities || []) {
    console.log(`${activity.originator}: ${activity.description}`);
}
```

### Source Discovery

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

// List all sources
const sourcesData = await client.listSources(50);
const sources = sourcesData.sources || [];

// Find a specific repo
for (const source of sources) {
    const githubRepo = source.githubRepo;
    const owner = githubRepo?.owner;
    const repo = githubRepo?.repo;
    
    if (owner === "myorg" && repo === "myrepo") {
        console.log(`Found source: ${source.name}`);
        
        // Get detailed info including branches
        const details = await client.getSource(source.name);
        const branches = details.githubRepo?.branches || [];
        
        console.log("Available branches:");
        for (const branch of branches) {
            console.log(`  - ${branch.displayName}`);
        }
    }
}
```

### Error Handling

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

try {
    const session = await client.createSession({
        prompt: "Add tests",
        sourceId: "sources/nonexistent-repo"
    });
} catch (error: any) {
    if (error.response) {
        console.log(`HTTP Error: ${error.message}`);
        console.log(`Status Code: ${error.response.status}`);
        console.log(`Response: ${JSON.stringify(error.response.data)}`);
    } else {
        console.log(`Error: ${error.message}`);
    }
}
```

### Pagination Example

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

// Get all sessions using pagination
let allSessions: any[] = [];
let pageToken: string | undefined = undefined;

while (true) {
    const result = await client.listSessions(30, pageToken);
    allSessions = allSessions.concat(result.sessions || []);
    
    pageToken = result.nextPageToken;
    if (!pageToken) {
        break;
    }
}

console.log(`Total sessions: ${allSessions.length}`);
```

### Activity Monitoring with Filtering

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

const sessionId = "1234567";
let lastTimestamp: string | undefined = undefined;

// Poll for new activities
while (true) {
    const result = await client.listActivities(
        sessionId,
        50,
        undefined,
        lastTimestamp
    );
    
    const activities = result.activities || [];
    
    for (const activity of activities) {
        console.log(`${activity.createTime}: ${activity.description}`);
        
        // Check for artifacts
        if (activity.artifacts) {
            for (const artifact of activity.artifacts) {
                if (artifact.changeSet) {
                    console.log("  Code changes detected!");
                } else if (artifact.bashOutput) {
                    console.log(`  Command output: ${artifact.bashOutput.output}`);
                }
            }
        }
    }
    
    if (activities.length > 0) {
        lastTimestamp = activities[activities.length - 1].createTime;
    }
    
    // Check session state
    const session = await client.getSession(sessionId);
    if (["COMPLETED", "FAILED"].includes(session.state)) {
        console.log(`Session finished: ${session.state}`);
        break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### Workflow Automation

```typescript
import { JulesClient } from './jules_client';

async function createAndMonitorSession(client: JulesClient, prompt: string, repo: string, branch: string = "main") {
    /** Create a session and monitor until completion. */
    
    // Create session
    const session = await client.createSession({
        prompt,
        sourceId: `sources/github-${repo.replace('/', '-')}`,
        startingBranch: branch,
        automationMode: "AUTO_CREATE_PR"
    });
    
    const sessionId = session.name.split("/")[1];
    console.log(`Created session ${sessionId}`);
    
    // Monitor until completion
    while (true) {
        const sessionData = await client.getSession(sessionId);
        const state = sessionData.state;
        
        console.log(`Status: ${state}`);
        
        if (["COMPLETED", "FAILED"].includes(state)) {
            // Get outputs
            const outputs = sessionData.outputs || [];
            for (const output of outputs) {
                if (output.pullRequest) {
                    const prUrl = output.pullRequest.url;
                    console.log(`Pull Request: ${prUrl}`);
                }
            }
            
            return sessionData;
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

// Usage
const client = new JulesClient("your-api-key");

const result = await createAndMonitorSession(
    client,
    "Add logging to all API endpoints",
    "myorg/myrepo",
    "develop"
);
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

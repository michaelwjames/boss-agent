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
npx tsx skills/jules-agent/jules_client.ts create --prompt "TASK_DESCRIPTION" [OPTIONS]
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
npx tsx skills/jules-agent/jules_client.ts list-sessions [--page-size N]
```

### Get Session Details
```bash
npx tsx skills/jules-agent/jules_client.ts get-session --session-id SESSION_ID
```

### Delete Session
```bash
npx tsx skills/jules-agent/jules_client.ts delete-session --session-id SESSION_ID
```

### Send Message to Session
```bash
npx tsx skills/jules-agent/jules_client.ts send-message --session-id SESSION_ID --message "MESSAGE"
```

### Approve Plan
```bash
npx tsx skills/jules-agent/jules_client.ts approve-plan --session-id SESSION_ID
```

### List Activities
```bash
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id SESSION_ID [--page-size N]
```

### Get Activity Details
```bash
npx tsx skills/jules-agent/jules_client.ts get-activity --session-id SESSION_ID --activity-id ACTIVITY_ID
```

### List Sources
```bash
npx tsx skills/jules-agent/jules_client.ts list-sources [--page-size N] [--filter "EXPRESSION"]
```

### Get Source Details
```bash
npx tsx skills/jules-agent/jules_client.ts get-source --source-id SOURCE_ID
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
npx tsx skills/jules-agent/jules_client.ts create --prompt "Build a FastAPI server with one endpoint"

# Create a session with repository
npx tsx skills/jules-agent/jules_client.ts create --prompt "Add unit tests for auth module" --repo myorg/myrepo --branch develop

# Create session with plan approval required
npx tsx skills/jules-agent/jules_client.ts create --prompt "Refactor database layer" --repo myorg/myrepo --require-approval

# List all sessions
npx tsx skills/jules-agent/jules_client.ts list-sessions

# Get session details
npx tsx skills/jules-agent/jules_client.ts get-session --session-id 1234567

# Send follow-up message
npx tsx skills/jules-agent/jules_client.ts send-message --session-id 1234567 --message "Also add integration tests"

# Approve a pending plan
npx tsx skills/jules-agent/jules_client.ts approve-plan --session-id 1234567

# View session activities
npx tsx skills/jules-agent/jules_client.ts list-activities --session-id 1234567

# List connected repositories
npx tsx skills/jules-agent/jules_client.ts list-sources
```

## Advanced Features

### Pagination
All list commands support pagination:
```bash
npx tsx skills/jules-agent/jules_client.ts list-sessions --page-size 50
```

### Filtering Sources
Filter repositories using AIP-160 expressions:
```bash
npx tsx skills/jules-agent/jules_client.ts list-sources --filter "name=sources/github-myorg-myrepo"
```

### Context Files
Include additional context from files:
```bash
npx tsx skills/jules-agent/jules_client.ts create --prompt "Fix the bug" --context-file bug_report.txt --repo myorg/myrepo
```

### Automation Modes
- `AUTOMATION_MODE_UNSPECIFIED`: Default behavior
- `AUTO_CREATE_PR`: Automatically create pull requests when code is ready

```bash
npx tsx skills/jules-agent/jules_client.ts create --prompt "Add feature" --repo myorg/myrepo --auto-pr
```

## Error Handling

The client provides detailed error messages for:
- Authentication failures (invalid API key)
- Missing repositories (not connected to Jules)
- Invalid session states
- Network errors
- API rate limits

All errors include HTTP status codes and detailed messages from the API.

## TypeScript API Usage

The `JulesClient` class can also be used programmatically:

```typescript
import { JulesClient } from './jules_client';

const client = new JulesClient('your-api-key');

// Create a session
const session = await client.createSession({
    prompt: 'Build a REST API',
    title: 'API Development',
    requirePlanApproval: true
});

// List sessions
const sessions = await client.listSessions(10);

// Send a message
await client.sendMessage('1234567', 'Add authentication');

// Approve plan
await client.approvePlan('1234567');
```

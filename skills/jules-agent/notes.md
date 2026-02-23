# Notes: Jules Client GUI Wrapper UX

## Sources

### Source 1: Jules client capabilities (jules_client.py)
- Key points:
  - Commands: create, list-sessions, get-session, delete-session, send-message, approve-plan, list-activities, get-activity, list-sources, get-source
  - Create supports prompt, title, repo, branch, context file, require approval, auto PR, no-poll
  - List endpoints support pagination and filters

## Synthesized Findings

### UX Goals
- Provide a clear dashboard with: session creation, live status, and history
- Make repo/branch selection easy with live source/branch loading
- Offer quick actions for sessions (approve plan, send message, delete)
- Provide activity timeline and raw JSON details for advanced users
- Ensure user understands required API key and local execution

### Recommended Layout
- Header with status, API key indicator, and refresh controls
- Left panel: session creation + source/branch selectors + automation options
- Middle panel: session list with status chips, selectable rows
- Right panel: session detail tabs (Overview, Activities, Outputs, Raw JSON)
- Bottom drawer: command execution log + output stream

### Primary Flows
1. Load sources → choose repo/branch → create session
2. Monitor session state and activities → approve plan / send message
3. Inspect outputs and PR links
4. Browse history via session list and activity timeline

### UI Components
- Dropdowns: repo, branch, automation mode
- Toggles: require plan approval, auto PR, no polling
- Lists: sessions, activities
- Forms: send message, create session
- Buttons: create, refresh, approve, delete
- JSON viewer (preformatted) for raw responses

### Implementation Constraints
- Do not modify jules_client.py
- Provide a single-file HTML/JS/CSS frontend
- Use a minimal local API bridge to run the client commands (server can be separate)

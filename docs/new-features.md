1. Core Architecture and Modalities
The Boss Agent is designed as a dual-modal system handling both text and audio inputs seamlessly.
• Audio Input Processing: Voice notes sent to the agent will be routed to the Groq service, which utilizes the Whisper model to generate text transcriptions for the agent to execute.
• Audio Output Mode: The system will feature an "audio mode" utilizing a text-to-speech model to convert the agent's text responses into return voice notes or audio files.
    ◦ Ambiguity Highlight: There is uncertainty regarding the technical feasibility of sending a native voice note versus a standard audio file.
• The Makefile Gatekeeper: To enforce a strict safety-first architecture, the agent is prohibited from interacting directly with the host machine's terminal. The sole execution entry point will be a root-level Makefile, meaning the agent can only trigger predefined make commands.
2. LLM Provider Strategy and Constrained Wrappers
Giving the agent direct access to global CLI tools is flagged as a major security vulnerability, requiring custom intermediaries.
• Safe Gemini Wrapper: The system will restrict the Gemini CLI using a "Safe Gemini" wrapper. This isolates the model's capabilities to only three permitted functions: web search, deep research, and image generation.
• Plug-and-Play Architecture: The backend will support a flexible provider strategy, allowing seamless switching between OpenAI, Anthropic, and Google models through intermediary scripts.
3. Software Engineering and DevOps Pipeline
The agent functions as an automated developer assistant with heavy reliance on external cloud environments, primarily Jules.
• Nomenclature Middleware: To counteract voice-to-text spelling errors, a repository cataloging tool will act as middleware. It will cross-reference exact file and repository names before submitting commands to Jules or Gemini.
• Pull Request Management: A Git and GitHub API wrapper will allow the agent to fetch PR diffs, generate natural language summaries of the changes, and execute commands to merge or close the PRs.
    ◦ Ambiguity Highlight: It is unclear whether to build a custom diff extraction tool or rely on Jules's existing API capabilities.
    ◦ Ambiguity Highlight: There is uncertainty regarding the implementation method for success metrics, specifically whether using standard CURL commands is the optimal approach.
• Vercel MCP Server: The agent will access build and deployment logs via Vercel, allowing it to feed deployment errors back into Jules for automated debugging and review.
• Repository Creator Skill: The agent will be able to receive a source file via WhatsApp, bundle it with necessary agent skill scripts, initialize a local Git repository, sync it to GitHub, and automatically trigger Jules to perform tasks on the new repo.
4. Productivity, Task Management, and PKM
The Boss Agent will autonomously manage personal knowledge and track tasks.
• Local Markdown Store: The agent will manage personal logs, journal entries, and ideas strictly within a local markdown file system.
• Linear Integration: Using an MCP server, the agent will interface with Linear to create issues, list issues, and retrieve issue comments.
• Heartbeat System: Cron jobs will wake the agent at scheduled intervals, such as every 30 minutes, to check for task updates from Jules or to ping the user for necessary feedback.
• Proactive Task Enforcer: A calendar and to-do list skill will enforce strict time syntax. If the user inputs an invalid time, an intermediary interface will force the agent to ask for clarification. Furthermore, tasks will have priority weightings; if a high-priority task is neglected, the agent will proactively contact the user to demand an explanation.
5. Communication Nodes
The system requires an arms-length communication strategy, leaning heavily on third-party messaging clients.
• WhatsApp Group Node: Using the WhatsApp-Web.js client, the agent will operate a dedicated, separate WhatsApp account. Communication will happen exclusively in a group chat containing just the user and the agent. Any message or file sent to this group is construed as a direct command, ensuring the user receives standard push notifications.
    ◦ Ambiguity Highlight: The use of WhatsApp-Web.js might violate WhatsApp's Terms of Service, which needs to be officially clarified.
    ◦ Ambiguity Highlight: Guardrails for communicating with outside contacts are undefined, requiring further investigation into intermediating the communication side of things.
• Email Wrapper: The system plans to use an SMTP wrapper tied to a test email account to send and read emails.
    ◦ Ambiguity Highlight: The exact approach to email integration is still conceptual and requires further technical definition.
6. Dynamic Skill Creation Framework
The agent is explicitly forbidden from autonomously writing its own executable skills locally; instead, it delegates this to a secure environment.
• Jules Delegation Workflow: A "create skill" wrapper will allow the Boss Agent to pass parameters to Jules, which will perform the actual coding and logic generation in an isolated cloud VM.
• Skill Downloading and Allow-lists: Once Jules finishes, the agent will download the script and securely update its local allow-lists so the agent is granted permission to use the new file.
• Skill Templating: Skills will be built using a "template Jules skill" pattern so that the resulting scripts inherently know how to route complex computation back to the Jules API or CLI, with strict argument sanitization to prevent malicious exploitation.
7. Persona Engineering and UX
To improve the user experience, the system includes a customizable personality framework.
• The soul.md File: A root-level markdown file will inject a system prompt dictating the agent's behavior.
• Ironic Personality: The agent will be programmed to highlight the paradox of its name. It must constantly joke that it is called "The Boss" when, in reality, it is a strictly obedient servant to a user who does not fully trust it. The user can dynamically iterate on this file to change the agent's jokes and tone over time.
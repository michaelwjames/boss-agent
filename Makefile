.PHONY: help status test list-files read-file read-skill git-status git-diff git-log pr-list pr-diff pr-view pr-merge pr-close safe-gemini git-summary linear-task vercel-logs remind jules-help jules context-stats create-boss-skills

# --- Help ---
help:
	@echo "Available commands:"
	@echo "  System:"
	@echo "    make status              - Check agent status"
	@echo "    make test                - Run tests"
	@echo "    make context-stats       - Show token usage and context window stats"
	@echo ""
	@echo "  Files:"
	@echo "    make list-files DIR=.    - List files in directory"
	@echo "    make read-file FILE=x    - Read file contents"
	@echo "    make read-skill S=x      - Read a skill's SKILL.md file"
	@echo ""
	@echo "  Git:"
	@echo "    make git-status          - Show working tree status"
	@echo "    make git-diff            - Show unstaged changes"
	@echo "    make git-log             - Show last 20 commits"
	@echo "    make git-summary         - Summarized git report"
	@echo ""
	@echo "  Pull Requests:"
	@echo "    make pr-list             - List open PRs"
	@echo "    make pr-diff PR_NUMBER=N - Show PR diff"
	@echo "    make pr-view PR_NUMBER=N - Show PR details"
	@echo "    make pr-merge PR_NUMBER=N- Merge a PR"
	@echo "    make pr-close PR_NUMBER=N- Close a PR"
	@echo ""
	@echo "  Reminders:"
	@echo "    make remind DELAY=5m MESSAGE=x DISCORD_WEBHOOK_URL=x - Set a reminder"
	@echo ""
	@echo "  Integrations:"
	@echo "    make safe-gemini QUERY=x - Run a safe web search / deep research via Gemini"
	@echo "    make linear-task TITLE=x DESCRIPTION=x - Create a Linear task"
	@echo "    make vercel-logs         - Fetch Vercel deployment logs"
	@echo ""
	@echo "  Jules Agent (External PR/Repo tool):"
	@echo "    make jules-help          - Show Jules Agent help"
	@echo "    make jules A=\"--action args\" - Run Jules Agent with custom arguments"
	@echo ""
	@echo "  Meta:"
	@echo "    make create-boss-skills NAME=x PROMPT=y - Create a new skill"

# --- System ---
status:
	@echo "Boss Agent makefile executor is operational."

test:
	npm test

context-stats:
	@npx tsx -e "import { TokenTracker } from './app/lib/token_tracker.js'; const tracker = new TokenTracker(); const stats = tracker.getRateLimitStats(process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'); console.log(JSON.stringify(stats, null, 2));"

# --- Files ---
list-files:
	ls -F $(DIR)

read-file:
	cat $(FILE)

read-skill:
	cat data/skills/$(S)/SKILL.md

# --- Git ---
git-status:
	git status

git-diff:
	git diff

git-log:
	git log --oneline -20

git-summary:
	node data/skills/git_wrapper.js summary

# --- Pull Requests (via gh CLI) ---
pr-list:
	gh pr list

pr-diff:
	gh pr diff $(PR_NUMBER)

pr-view:
	gh pr view $(PR_NUMBER)

pr-merge:
	gh pr merge $(PR_NUMBER) --merge --delete-branch

pr-close:
	gh pr close $(PR_NUMBER)

# --- Reminders ---
remind:
	npx tsx data/skills/remind.ts "$(DELAY)" "$(DISCORD_WEBHOOK_URL)" "$(MESSAGE)" &
	@echo "Reminder scheduled: '$(MESSAGE)' in $(DELAY)"

# --- Integrations ---
safe-gemini:
	node data/skills/safe_gemini.js "$(QUERY)"

linear-task:
	node data/skills/linear_wrapper.js create "$(TITLE)" "$(DESCRIPTION)"

vercel-logs:
	node data/skills/vercel_wrapper.js logs


# --- Meta ---
create-boss-skills-help:
	@echo "Usage: make create-boss-skills NAME=name PROMPT=prompt"

create-boss-skills:
	npx tsx data/skills/create-boss-skills/index.ts --name="$(NAME)" --prompt="$(PROMPT)"

gemini-image:
	npx tsx data/skills/gemini_wrapper.ts image "$(QUERY)"

# --- Jules Agent (Python Client) ---
JULES_CLIENT = python3 data/skills/jules-agent/jules_client.py

jules-list-sources:
	@$(JULES_CLIENT) list-sources --format=plain $(if $(SIZE),--page-size $(SIZE))

jules-list-sessions:
	@$(JULES_CLIENT) list-sessions --format=plain $(if $(SIZE),--page-size $(SIZE))

jules-get-session:
	@$(JULES_CLIENT) get-session --session-id $(ID) --format=plain

jules-delete-session:
	@$(JULES_CLIENT) delete-session --session-id $(ID) --format=plain

jules-send-message:
	@$(JULES_CLIENT) send-message --session-id $(ID) --message "$(MESSAGE)" --format=plain

jules-approve-plan:
	@$(JULES_CLIENT) approve-plan --session-id $(ID) --format=plain

jules-list-activities:
	@$(JULES_CLIENT) list-activities --session-id $(ID) --format=plain $(if $(SIZE),--page-size $(SIZE))

jules-create-session:
	@$(JULES_CLIENT) create --prompt "$(PROMPT)" \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(REPO),--repo $(REPO)) \
		$(if $(BRANCH),--branch $(BRANCH)) \
		--no-poll --format=plain

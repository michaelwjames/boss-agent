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

# --- Jules Agent (Direct API) ---
JULES_BASE_URL = https://jules.googleapis.com/v1alpha

jules-list-sources:
	@curl -s -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sources?pageSize=$(or $(SIZE),30) | jq .

jules-list-sessions:
	@curl -s -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sessions?pageSize=$(or $(SIZE),30) | jq .

jules-get-session:
	@curl -s -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sessions/$(ID) | jq .

jules-delete-session:
	@curl -s -X DELETE -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sessions/$(ID)

jules-send-message:
	@curl -s -X POST -H "x-goog-api-key: $(JULES_API_KEY)" -H "Content-Type: application/json" \
		-d '{"prompt": "$(MESSAGE)"}' \
		$(JULES_BASE_URL)/sessions/$(ID):sendMessage | jq .

jules-approve-plan:
	@curl -s -X POST -H "x-goog-api-key: $(JULES_API_KEY)" -H "Content-Type: application/json" \
		-d '{}' \
		$(JULES_BASE_URL)/sessions/$(ID):approvePlan | jq .

jules-list-activities:
	@curl -s -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sessions/$(ID)/activities?pageSize=$(or $(SIZE),50) | jq .

jules-create-session:
	@if [ -n "$(REPO)" ]; then \
		SOURCE_ID=$$(curl -s -H "x-goog-api-key: $(JULES_API_KEY)" $(JULES_BASE_URL)/sources?pageSize=100 | jq -r '.sources[] | select(.githubRepo.owner + "/" + .githubRepo.repo == "$(REPO)") | .name'); \
		if [ -z "$$SOURCE_ID" ]; then echo "Error: Source for $(REPO) not found."; exit 1; fi; \
		curl -s -X POST -H "x-goog-api-key: $(JULES_API_KEY)" -H "Content-Type: application/json" \
			-d '{"prompt": "$(PROMPT)", "title": "$(or $(TITLE),Session for $(REPO))", "automationMode": "$(or $(MODE),AUTOMATION_MODE_UNSPECIFIED)", "sourceContext": {"source": "'$$SOURCE_ID'", "githubRepoContext": {"startingBranch": "$(or $(BRANCH),main)"}}}' \
			$(JULES_BASE_URL)/sessions | jq .; \
	else \
		curl -s -X POST -H "x-goog-api-key: $(JULES_API_KEY)" -H "Content-Type: application/json" \
			-d '{"prompt": "$(PROMPT)", "title": "$(or $(TITLE),Repoless Session)", "automationMode": "$(or $(MODE),AUTOMATION_MODE_UNSPECIFIED)"}' \
			$(JULES_BASE_URL)/sessions | jq .; \
	fi

.PHONY: help status test list-files read-file read-skill git-status git-diff git-log pr-list pr-diff pr-view pr-merge pr-close safe-gemini git-summary linear-task vercel-logs remind jules-help jules

# --- Help ---
help:
	@echo "Boss Agent — Allowed Make Targets:"
	@echo ""
	@echo "  System:"
	@echo "    make status              - Check agent status"
	@echo "    make test                - Run tests"
	@echo ""
	@echo "  Files:"
	@echo "    make list-files DIR=.    - List files in directory"
	@echo "    make read-file FILE=x    - Read a file"
	@echo "    make read-skill S=x      - Read a skill's SKILL.md file"
	@echo ""
	@echo "  Git:"
	@echo "    make git-status          - Show working tree status"
	@echo "    make git-diff            - Show unstaged changes"
	@echo "    make git-log             - Show last 20 commits"
	@echo "    make git-summary         - Summarized git report"
	@echo ""
	@echo "  Pull Requests (gh CLI):"
	@echo "    make pr-list             - List open PRs"
	@echo "    make pr-diff PR_NUMBER=N - Show PR diff"
	@echo "    make pr-view PR_NUMBER=N - Show PR details"
	@echo "    make pr-merge PR_NUMBER=N- Merge a PR"
	@echo "    make pr-close PR_NUMBER=N- Close a PR"
	@echo ""
	@echo "  Reminders:"
	@echo "    make remind DELAY=5m MESSAGE=x - Set a delayed reminder (s/m/h)"
	@echo ""
	@echo "  Integrations:"
	@echo "    make safe-gemini QUERY=x - Run safe Gemini query"
	@echo "    make linear-task TITLE=x DESCRIPTION=x - Create Linear task"
	@echo "    make vercel-logs         - Fetch Vercel deployment logs"
	@echo "    make gemini-search QUERY=x - Run web search via Gemini"
	@echo "    make gemini-research QUERY=x - Run deep research via Gemini"
	@echo "    make gemini-image QUERY=x - Generate image via Gemini"
	@echo ""
	@echo "  Jules Agent (API):"
	@echo "    make jules-list-sources  - List connected Jules sources"
	@echo "    make jules-list-sessions - List Jules sessions"
	@echo "    make jules-get-session ID=x - Get Jules session details"
	@echo "    make jules-delete-session ID=x - Delete Jules session"
	@echo "    make jules-send-message ID=x MESSAGE=y - Send message to session"
	@echo "    make jules-approve-plan ID=x - Approve Jules plan"
	@echo "    make jules-list-activities ID=x - List Jules activities"
	@echo "    make jules-create-session PROMPT=x [REPO=y] [TITLE=z] [MODE=a] - Create Jules session"

# --- System ---
status:
	@echo "Boss Agent is running."

test:
	npm test

# --- Files ---
list-files:
	ls -F $(DIR)

read-file:
	cat $(FILE)

read-skill:
	cat skills/$(S)/SKILL.md

# --- Git ---
git-status:
	git status

git-diff:
	git diff

git-log:
	git log --oneline -20

git-summary:
	node skills/git_wrapper.js summary

# --- Pull Requests (via gh CLI) ---
pr-list:
	gh pr list

pr-diff:
	gh pr diff $(PR_NUMBER)

pr-view:
	gh pr view $(PR_NUMBER)

pr-merge:
	gh pr merge $(PR_NUMBER) --merge

pr-close:
	gh pr close $(PR_NUMBER)

# --- Reminders ---
remind:
	npx tsx skills/remind.ts "$(DELAY)" "$(DISCORD_WEBHOOK_URL)" "$(MESSAGE)" &
	@echo "Reminder scheduled: '$(MESSAGE)' in $(DELAY)"

# --- Integrations ---
safe-gemini:
	node skills/safe_gemini.js "$(QUERY)"

linear-task:
	node skills/linear_wrapper.js create "$(TITLE)" "$(DESCRIPTION)"

vercel-logs:
	node skills/vercel_wrapper.js logs

gemini-search:
	npx tsx skills/gemini_wrapper.ts search "$(QUERY)"

gemini-research:
	npx tsx skills/gemini_wrapper.ts research "$(QUERY)"

gemini-image:
	npx tsx skills/gemini_wrapper.ts image "$(QUERY)"

# --- Create Boss Skills ---
create-boss-skills-help:
	@echo "Usage: make create-boss-skills NAME=name PROMPT=prompt"

create-boss-skills:
	npx tsx skills/create-boss-skills/index.ts --name="$(NAME)" --prompt="$(PROMPT)"

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

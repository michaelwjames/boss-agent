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
	@echo ""
	@echo "  Jules Agent:"
	@echo "    make jules-help          - Show help for Jules client"
	@echo "    make jules A="args"      - Run Jules client with arguments"

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

# --- Jules Agent ---
jules-help:
	npx tsx skills/jules-agent/jules_client.ts --help

jules:
	npx tsx skills/jules-agent/jules_client.ts $(A)

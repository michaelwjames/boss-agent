.PHONY: help list-files read-file write-file test safe-gemini git-summary linear-task vercel-logs

help:
	@echo "Available commands:"
	@echo "  make list-files PATH=<path>"
	@echo "  make read-file FILE=<file>"
	@echo "  make write-file FILE=<file> CONTENT='<content>'"
	@echo "  make test"
	@echo "  make safe-gemini QUERY=<query>"
	@echo "  make git-summary"
	@echo "  make linear-task TITLE=<title> DESCRIPTION=<description>"
	@echo "  make vercel-logs"

list-files:
	ls -F $(PATH)

read-file:
	cat $(FILE)

write-file:
	echo "$(CONTENT)" > $(FILE)

test:
	npm test

safe-gemini:
	node skills/safe_gemini.js "$(QUERY)"

git-summary:
	node skills/git_wrapper.js summary

linear-task:
	node skills/linear_wrapper.js create "$(TITLE)" "$(DESCRIPTION)"

vercel-logs:
	node skills/vercel_wrapper.js logs

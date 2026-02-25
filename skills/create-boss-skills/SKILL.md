# create-boss-skills

## Description
A meta-skill for automatically creating and registering new skills for the Boss Agent. It generates necessary directory structures, reference files, and updates system configurations.

## Usage
`make create-boss-skills NAME="{SKILL_NAME}" PROMPT="{SKILL_REQUIREMENTS}"`

## Help
`make create-boss-skills-help`

## Examples
```bash
make create-boss-skills NAME="pdf-summarizer" PROMPT="A skill that takes a PDF path and returns a summary"
```

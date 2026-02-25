# Agent Skill Specification: create-boss-skills

This document defines the requirements for the "create-boss-skills" skill.

1. **Language**: TypeScript (ESM)
2. **Execution**: Must be runnable via `npx tsx skills/create-boss-skills/index.ts`.
3. **Makefile Integration**:
   - `make create-boss-skills NAME="..." PROMPT="..."`
   - `make create-boss-skills-help`
   - `make read-skill S=create-boss-skills`
4. **Documentation**: Must include a `SKILL.md` in the skill directory.
5. **Output**: Should be concise and formatted for LLM consumption.
6. **Safety**: Sanitize all inputs. No arbitrary shell execution.
7. **Automation**: Must update `vault/skill_catalogue.md`, `Makefile`, and `lib/tools.json`.

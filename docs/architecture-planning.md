# SKill Development

- each skill has three related Makefile commands:

    - make read-skill S={skill-name} // for understanding a skill
    - make {skill-name}-help // for finding out a skill's available arguments
    - make {skill-name} A=[arguments] // for using a skill

- skills ALWAYS need to be mediated through a Typescript script: 

- if skills need to generate an output, a repoless Jules session is triggered

# Memory

- use YAML tags and frontmatter for efficient querying
- title; tags; date_created; always_remember=true/false; forget_after=30 (default is 30 days)
- soft deletes only - a forget-memory skill which moves memory files into a forgotten_memories folder that cannot be accessed by the Boss Agent
- hard rules for modifying memories: can't modify a memory file more than an hour after it was created. Can only be forgotten (i.e. archived).
- create a generic skill for generating/modifying/removing memory entries according to a uniform, queryable table structure
- several special memory files:
    - words.md // for unusual words that may not be identified by the bass agent
    - special_dates.md 
    - interests.md  // needs skill for adding/modifying/removing
    - recommendations.md  // needs skill for adding/modifying
    - people.md  
    - tasks/todo.md  
    - tasks/blocked.md
    - tasks/next_up.md
    - tasks/backlog.md
    - tasks/in_progress.md
    - tasks/done.md
    - tasks/current_task.md // the current specific task the Boss is working on
    - tasks/current_plan.md // the current plan the agent is following for a specific task
    - user_preferences/*.md // these are one-liner files


# Communication

A folder for boss & user workshopped drafts of messages/emails
- create a communication-skill
    - instructions on different comms genres (WA, email, etc)
    - file naming conventions
    - style & formatting conventions




import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

/**
 * create-boss-skills/index.ts
 * Refactored automation script for creating new Boss Agent skills.
 */

const program = new Command();

program
  .name('create-boss-skills')
  .description('Automation script for creating new Boss Agent skills')
  .requiredOption('--name <name>', 'Name of the new skill (e.g., pdf-summarizer)')
  .requiredOption('--prompt <prompt>', 'Description of the skill requirements')
  .action(async (options) => {
    const { name, prompt } = options;
    const skillDir = path.join('skills', name);

    const spinner = ora(chalk.blue(`Initializing skill creation for "${name}"...`)).start();

    try {
      // 1. Create directory
      await fs.ensureDir(skillDir);

      // 2. Generate agent_skills_spec.md
      const agentSkillsSpec = `# Agent Skill Specification: ${name}

This document defines the requirements for the "${name}" skill.

1. **Language**: TypeScript (ESM)
2. **Execution**: Must be runnable via \`npx tsx skills/${name}/index.ts\`.
3. **Makefile Integration**:
   - \`make ${name} A="arguments"\`
   - \`make ${name}-help\`
   - \`make read-skill S=${name}\`
4. **Documentation**: Must include a \`SKILL.md\` in the skill directory.
5. **Output**: Should be concise and formatted for LLM consumption. Large outputs should be summarized or written to a file.
6. **Safety**: Sanitize all inputs. No arbitrary shell execution.
`;
      await fs.writeFile(path.join(skillDir, 'agent_skills_spec.md'), agentSkillsSpec);

      // 3. Generate SKILL.md template
      const skillMd = `# ${name}

## Description
${prompt.substring(0, 500)}

## Usage
\`make ${name} A="{ARGS}"\`

## Help
\`make ${name}-help\`

## Examples
\`\`\`bash
make ${name} A="..."
\`\`\`
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

      // 4. Generate SKILL_PROMPT.md
      const skillPromptMd = `# SKILL PROMPT: ${name}

## User Requirements
${prompt}

## Instructions for Jules
Please implement the skill in \`skills/${name}/index.ts\`.
Follow the specifications in \`skills/${name}/agent_skills_spec.md\`.
Ensure the skill is well-documented in \`SKILL.md\`.
Handle errors gracefully and provide helpful feedback.
`;
      await fs.writeFile(path.join(skillDir, 'SKILL_PROMPT.md'), skillPromptMd);

      spinner.succeed(chalk.green('Generated skill directory and reference files.'));

      // 5. Update vault/skill_catalogue.md
      spinner.start(chalk.blue('Updating skill catalogue...'));
      const cataloguePath = 'vault/skill_catalogue.md';
      let catalogue = await fs.readFile(cataloguePath, 'utf8');
      if (!catalogue.includes(`### ${name}`)) {
        const newEntry = `
### ${name}
- **Description:** ${prompt.substring(0, 150)}${prompt.length > 150 ? '...' : ''}
- **Location:** \`skills/${name}/\`
- **Make Target:** \`make ${name} A=\`
- **Detailed Docs:** \`skills/${name}/SKILL.md\`
`;
        catalogue += newEntry;
        await fs.writeFile(cataloguePath, catalogue);
        spinner.succeed(chalk.green('Updated vault/skill_catalogue.md'));
      } else {
        spinner.info(chalk.yellow('Skill already exists in catalogue. Skipping update.'));
      }

      // 6. Update Makefile
      spinner.start(chalk.blue('Updating Makefile...'));
      const makefilePath = 'Makefile';
      let makefile = await fs.readFile(makefilePath, 'utf8');
      if (!makefile.includes(`${name}:`)) {
        const newTargets = `
# --- ${name} ---
${name}-help:
	npx tsx skills/${name}/index.ts --help

${name}:
	npx tsx skills/${name}/index.ts $(A)
`;
        makefile += newTargets;
        await fs.writeFile(makefilePath, makefile);
        spinner.succeed(chalk.green('Updated Makefile'));
      } else {
        spinner.info(chalk.yellow('Skill targets already exist in Makefile. Skipping update.'));
      }

      // 7. Update lib/tools.json
      spinner.start(chalk.blue('Updating tool definitions...'));
      const toolsPath = 'lib/tools.json';
      const tools = await fs.readJson(toolsPath);
      if (!tools.find((t: any) => t.function.name === name)) {
        tools.push({
          type: 'function',
          function: {
            name: name,
            description: prompt.substring(0, 200),
            parameters: {
              type: 'object',
              properties: {
                A: {
                  type: 'string',
                  description: 'Arguments for the skill'
                }
              },
              required: ['A']
            }
          }
        });
        await fs.writeJson(toolsPath, tools, { spaces: 2 });
        spinner.succeed(chalk.green('Updated lib/tools.json'));
      } else {
        spinner.info(chalk.yellow('Tool already registered in lib/tools.json. Skipping update.'));
      }

      // 8. Trigger Jules session via API
      const JULES_API_KEY = process.env.JULES_API_KEY;
      if (JULES_API_KEY) {
        spinner.start(chalk.blue('Initiating Jules session via API...'));
        const julesPrompt = `You are tasked with creating a new skill for the Boss Agent.

Skill Name: ${name}
User Requirements: ${prompt}

The following stub files have been created in the repository:
- skills/${name}/agent_skills_spec.md (Specification)
- skills/${name}/SKILL.md (Documentation template)
- skills/${name}/SKILL_PROMPT.md (Your detailed instructions)

Please implement the skill logic in \`skills/${name}/index.ts\`.
Make sure it follows the Boss Agent architecture (ESM, TypeScript).
Do not modify core files unless absolutely necessary.
`;

        try {
          const response = await axios.post(
            'https://jules.googleapis.com/v1alpha/sessions',
            {
              prompt: julesPrompt,
              title: `Create Skill: ${name}`,
              automationMode: 'AUTOMATION_MODE_UNSPECIFIED'
            },
            {
              headers: {
                'x-goog-api-key': JULES_API_KEY,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );
          spinner.succeed(chalk.green(`Jules session created successfully: ${response.data.name}`));
        } catch (error: any) {
          const errorMsg = error.response?.data?.error?.message || error.message;
          spinner.warn(chalk.yellow(`Could not initiate Jules session: ${errorMsg}`));
        }
      } else {
        spinner.info(chalk.yellow('JULES_API_KEY missing. Skipping Jules session initiation. Files created locally.'));
      }

      console.log(chalk.bold.green(`\nSuccessfully created skill "${name}"!`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

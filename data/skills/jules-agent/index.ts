#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { JulesService } from './jules_service.js';
import { JulesNomenclature } from './jules_nomenclature.js';
import { JulesDatabase } from './jules_db.js';

const program = new Command();

program
  .name('jules-cli')
  .description('TypeScript CLI wrapper for Jules operations');

function normalizeSessionId(id: string): string {
  return id.startsWith('sessions/') ? id.substring(9) : id;
}

function formatSessionList(sessions: any[], cached: boolean = false): string {
  if (!sessions || sessions.length === 0) return 'No sessions found.';
  let output = 'Sessions:\n';
  for (const s of sessions) {
    const archivedMark = s.archived ? '[ARCHIVED] ' : '';
    const prompt = s.prompt ? (s.prompt.length > 150 ? s.prompt.substring(0, 147) + '...' : s.prompt) : '';
    const title = `${s.title || 'No Title'} | ${prompt}`;
    output += `  ${s.name} | ${archivedMark}${title} | ${s.state || 'UNKNOWN'} | ${s.createTime || ''}\n`;
  }
  if (cached) output += '\n[Data from cache]';
  return output;
}

function formatActivityList(activities: any[], cached: boolean = false): string {
  if (!activities || activities.length === 0) return 'No activities found.';
  let output = 'Activities:\n';
  for (const a of activities) {
    output += `  [${a.createTime || ''}] ${(a.originator || 'SYSTEM').toUpperCase()}: ${a.description || 'No description'}\n`;
  }
  if (cached) output += '\n[Data from cache]';
  return output;
}

const service = new JulesService();

program
  .command('list-sessions')
  .option('--page-size <number>', 'Number of sessions to return', '10')
  .option('--filter <string>', 'AIP-160 filter expression')
  .option('--format <string>', 'Output format', 'plain')
  .option('--force-refresh', 'Bypass cache')
  .action(async (options) => {
    const result = await service.listSessions(parseInt(options.pageSize), undefined, options.filter, options.forceRefresh);
    if (options.format === 'json') {
      console.log(JSON.stringify(result.sessions, null, 2));
    } else {
      console.log(formatSessionList(result.sessions, result.cached));
    }
  });

program
  .command('get-session')
  .requiredOption('--id <string>', 'Session ID')
  .option('--format <string>', 'Output format', 'plain')
  .option('--force-refresh', 'Bypass cache')
  .action(async (options) => {
    const session = await service.getSession(normalizeSessionId(options.id), options.forceRefresh);
    if (!session) {
      console.error(`Session ${options.id} not found.`);
      process.exit(1);
    }
    console.log(JSON.stringify(session, null, 2));
  });

program
  .command('delete-session')
  .requiredOption('--id <string>', 'Session ID')
  .action(async (options) => {
    const success = await service.deleteSession(normalizeSessionId(options.id));
    if (success) console.log(`Session ${options.id} deleted successfully.`);
    else console.error(`Failed to delete session ${options.id}.`);
  });

program
  .command('archive-session')
  .requiredOption('--id <string>', 'Session ID')
  .action(async (options) => {
    const success = await service.archiveSession(normalizeSessionId(options.id));
    if (success) console.log(`Session ${options.id} archived successfully.`);
    else console.error(`Failed to archive session ${options.id}.`);
  });

program
  .command('create')
  .requiredOption('--prompt <string>', 'Instruction for Jules')
  .option('--title <string>', 'Optional session title')
  .option('--repo <string>', 'Repository name (owner/repo)')
  .option('--branch <string>', 'Starting branch', 'master')
  .option('--require-approval', 'Require plan approval')
  .action(async (options) => {
    if (options.repo) {
      const nom = new JulesNomenclature();
      nom.loadCatalog();
      const res = nom.resolveRepoName(options.repo);
      if (res.exact) {
        options.repo = res.exact.name;
      } else if (res.candidates.length > 0) {
        console.error(`Error: Repository '${options.repo}' not found. Did you mean one of these?\n - ` + res.candidates.map(c => c.name).join('\n - '));
        process.exit(1);
      } else {
        console.error(`Error: Repository '${options.repo}' not found and no close matches discovered.`);
        process.exit(1);
      }
    }
    const session = await service.createSession(options.prompt, options.title, options.repo, options.branch, options.requireApproval);
    console.log(`Session Created! ID: ${session.name}`);
    if (session.url) console.log(`Web URL: ${session.url}`);
  });

program
  .command('send-message')
  .requiredOption('--id <string>', 'Session ID')
  .requiredOption('--message <string>', 'Message to send')
  .action(async (options) => {
    await service.sendMessage(normalizeSessionId(options.id), options.message);
    console.log(`Message sent to session ${options.id}`);
  });

program
  .command('approve-plan')
  .requiredOption('--id <string>', 'Session ID')
  .action(async (options) => {
    await service.approvePlan(normalizeSessionId(options.id));
    console.log(`Plan approved for session ${options.id}`);
  });

program
  .command('list-activities')
  .requiredOption('--id <string>', 'Session ID')
  .option('--page-size <number>', 'Number of activities to return', '10')
  .option('--filter <string>', 'AIP-160 filter expression')
  .option('--format <string>', 'Output format', 'plain')
  .option('--force-refresh', 'Bypass cache')
  .action(async (options) => {
    const result = await service.listActivities(normalizeSessionId(options.id), parseInt(options.pageSize), undefined, options.filter, options.forceRefresh);
    if (options.format === 'json') {
      console.log(JSON.stringify(result.activities, null, 2));
    } else {
      console.log(formatActivityList(result.activities, result.cached));
    }
  });

program
  .command('list-sources')
  .option('--page-size <number>', 'Number of sources to return', '10')
  .option('--format <string>', 'Output format', 'plain')
  .action(async (options) => {
    const result = await service.listSources(parseInt(options.pageSize));
    const sources = result.sources || [];
    if (options.format === 'json') {
      console.log(JSON.stringify(sources, null, 2));
    } else {
      if (sources.length === 0) {
        console.log('No sources found.');
      } else {
        console.log('Connected Sources:');
        for (const s of sources) {
          const gh = s.githubRepo || {};
          console.log(`  ${s.name} | ${gh.owner}/${gh.repo}`);
        }
      }
    }
  });

program
  .command('show-cached-sessions')
  .option('--limit <number>', 'Number of sessions to show', '5')
  .action(async (options) => {
    const sessions = service.getDb().listSessions(parseInt(options.limit));
    if (sessions.length === 0) {
      console.log('No cached sessions found.');
      return;
    }
    console.log('Cached Sessions:');
    for (const s of sessions) {
      const info = JulesDatabase.parseSourceContext(s.sourceContext);
      const repo = info.repo_name || 'Unknown';
      const branch = info.branch_name || 'Unknown';
      const time = JulesDatabase.formatTimestampHuman(s.updateTime || s.createTime);
      let title = s.title || 'No Title';
      if (title.length > 50) title = title.substring(0, 47) + '...';
      console.log(`- ${s.name} | ${repo}:${branch} | ${s.state} | ${title} | ${time}`);
    }
  });

program
  .command('fetch-latest-sessions')
  .option('--limit <number>', 'Maximum sessions to fetch', '50')
  .option('--format <string>', 'Output format', 'plain')
  .action(async (options) => {
    const result = await service.fetchLatestSessions(parseInt(options.limit));
    const formattedNew = result.new_sessions.map(s => {
      const info = JulesDatabase.parseSourceContext(s.sourceContext);
      return {
        name: s.name,
        repo_name: info.repo_name,
        branch_name: info.branch_name,
        title: s.title,
        state: s.state,
        create_time: JulesDatabase.formatTimestampHuman(s.createTime)
      };
    });
    const formattedUpdated = result.updated_sessions.map(s => {
      const info = JulesDatabase.parseSourceContext(s.sourceContext);
      return {
        name: s.name,
        repo_name: info.repo_name,
        branch_name: info.branch_name,
        title: s.title,
        state: s.state,
        create_time: JulesDatabase.formatTimestampHuman(s.createTime)
      };
    });

    if (options.format === 'json') {
      console.log(JSON.stringify({ ...result, new_sessions: formattedNew, updated_sessions: formattedUpdated }, null, 2));
    } else {
      console.log(`Fetched ${result.total_fetched} sessions from API`);
      console.log(`New sessions: ${result.new_sessions.length}`);
      console.log(`Updated sessions: ${result.updated_sessions.length}`);
      if (formattedNew.length > 0) {
        console.log('\nNew sessions:');
        for (const s of formattedNew) {
          const rb = s.repo_name ? `${s.repo_name}:${s.branch_name}` : 'N/A';
          console.log(`  ${s.name} | ${rb} | ${s.title} (${s.state}) | ${s.create_time}`);
        }
      }
      if (formattedUpdated.length > 0) {
        console.log('\nUpdated sessions:');
        for (const s of formattedUpdated) {
          const rb = s.repo_name ? `${s.repo_name}:${s.branch_name}` : 'N/A';
          console.log(`  ${s.name} | ${rb} | ${s.title} (${s.state}) | ${s.create_time}`);
        }
      }
    }
  });

program
  .command('get-session-status')
  .requiredOption('--id <string>', 'Session ID')
  .option('--activities <number>', 'Number of recent activities to include', '3')
  .option('--format <string>', 'Output format', 'plain')
  .action(async (options) => {
    const result = await service.getSessionStatus(normalizeSessionId(options.id), parseInt(options.activities));
    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.error) {
      console.error(`Error: ${result.error}`);
    } else {
      console.log(`Session: ${result.title || 'Unknown'} (${result.session_id})`);
      console.log(`Status: ${result.state || 'UNKNOWN'}`);
      console.log(`Last updated: ${JulesDatabase.formatTimestampHuman(result.update_time)}`);
      if (result.recent_activities) {
        console.log(`\nRecent activities (${result.recent_activities.length}):`);
        for (const act of result.recent_activities) {
          const time = JulesDatabase.formatTimestampHuman(act.time);
          const type = act.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          let content = act.content;
          if (content.length > 150) content = content.substring(0, 147) + '...';
          console.log(`  [${time}] ${type}: ${content}`);
        }
      }
    }
  });

program
  .command('get-pending-feedback')
  .requiredOption('--id <string>', 'Session ID')
  .option('--format <string>', 'Output format', 'plain')
  .action(async (options) => {
    const result = await service.getPendingFeedback(normalizeSessionId(options.id));
    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.error) {
      console.error(`Error: ${result.error}`);
    } else {
      console.log(`Session: ${result.title || 'Unknown'} (${result.session_id})`);
      console.log(`Awaiting feedback since: ${JulesDatabase.formatTimestampHuman(result.message_time)}`);
      console.log('-'.repeat(40));
      console.log(result.last_agent_message || 'No message content');
      console.log('-'.repeat(40));
      console.log(`Use 'make jules-send-message ID=${options.id} MESSAGE="your reply"' to respond.`);
    }
  });

try {
  await program.parseAsync(process.argv);
} catch (e: any) {
  let msg = e.message;
  if (msg.includes('sessions/')) msg = 'A session operation failed. Please check the session ID and try again.';
  console.error(`Error: ${msg}`);
  process.exit(1);
}

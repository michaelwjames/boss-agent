import { execSync } from 'child_process';

const command = process.argv[2];
const query = process.argv[3];

if (!command || !query) {
  console.error('Usage: npx tsx skills/gemini_wrapper.ts <command> <query>');
  console.error('Allowed commands: search, research, image');
  process.exit(1);
}

let prompt = '';
if (command === 'search') {
  prompt = `Please perform a web search to answer the following: ${query}`;
} else if (command === 'research') {
  prompt = `Please conduct deep research on the following topic: ${query}`;
} else if (command === 'image') {
  prompt = `Please generate an image based on this description: ${query}`;
} else {
  console.error('Unknown command. Allowed: search, research, image');
  process.exit(1);
}

try {
  // Use npx @google/gemini-cli for a headless call
  // We use the -p flag for headless mode
  const escapedPrompt = prompt.replace(/"/g, '\\"');
  const fullCommand = `npx @google/gemini-cli -p "${escapedPrompt}"`;
  console.log(`Executing Gemini CLI with prompt: ${prompt}`);
  const result = execSync(fullCommand, { encoding: 'utf8' });
  console.log(result);
} catch (error: any) {
  console.error('Error executing Gemini CLI:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.error('STDERR:', error.stderr);
  process.exit(1);
}

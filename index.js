import 'dotenv/config';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { GroqProvider } from './lib/groq_provider.js';
import { FileSystem } from './lib/file_system.js';
import { ShellExecutor } from './lib/shell_executor.js';

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY is not set in environment variables.');
  process.exit(1);
}

const groq = new GroqProvider(GROQ_API_KEY);
const fs = new FileSystem();
const shell = new ShellExecutor();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_PATH || undefined, // Useful for some environments
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('QR RECEIVED. Please scan with your WhatsApp app.');
});

client.on('ready', () => {
  console.log('Boss, the Operator is online and ready!');
});

client.on('message', async (msg) => {
  // Ignore status updates and group messages if you want, or handle them.
  // For this implementation, we handle everything incoming.
  if (msg.fromMe) return;

  const sessionId = msg.from.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    const chat = await msg.getChat();
    await chat.sendStateTyping();

    const vaultContext = await fs.readAllNotes();
    const history = await fs.loadSession(sessionId);

    const systemPrompt = `You are the "Boss Operator," a highly efficient AI agent.
RULES:
1. Always address the user as "Boss."
2. You have access to local Markdown files in the 'vault/', 'memory/', and 'skills/' directories. Use them to provide context.
3. You can execute terminal commands via 'run_terminal'.
4. You can call the 'jules' CLI tool for advanced tasks (e.g., 'jules --query "..."').
5. You can save new notes to memory using 'write_note'.
6. Keep your responses concise and action-oriented unless the Boss asks for detail.

CURRENT CONTEXT:
${vaultContext}
`;

    let messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: msg.body }
    ];

    let responseMessage = await groq.getChatCompletion(messages, groq.getToolsDefinition());

    // Tool execution loop
    while (responseMessage.tool_calls) {
      messages.push(responseMessage);
      
      for (const toolCall of responseMessage.tool_calls) {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString);
        let result;

        console.log(`[TOOL] Executing ${name} with args:`, args);

        if (name === 'run_terminal') {
          const shellResult = await shell.run(args.command);
          result = `STDOUT: ${shellResult.stdout}\nSTDERR: ${shellResult.stderr}\nExit Code: ${shellResult.exitCode}`;
        } else if (name === 'write_note') {
          result = await fs.writeNote(args.filename, args.content);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }

      responseMessage = await groq.getChatCompletion(messages, groq.getToolsDefinition());
    }

    // Send final response
    await client.sendMessage(msg.from, responseMessage.content);

    // Save history
    messages.push(responseMessage);
    await fs.saveSession(sessionId, messages.filter(m => m.role !== 'system').slice(-20));

  } catch (error) {
    console.error('Error handling message:', error);
    try {
      await client.sendMessage(msg.from, `Sorry Boss, I hit a snag: ${error.message}`);
    } catch (sendError) {
      console.error('Could not send error message to WhatsApp:', sendError);
    }
  }
});

client.initialize();

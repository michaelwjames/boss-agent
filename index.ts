import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Message } from 'discord.js';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { GroqProvider } from './lib/groq_provider.js';
import { FileSystem } from './lib/file_system.js';
import { ToolRegistry } from './lib/tools.js';
import { getEncoding } from 'js-tiktoken';
import { Nomenclature } from './lib/nomenclature.js';

// --- Configuration ---
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!DISCORD_BOT_TOKEN) {
  console.error('Error: DISCORD_BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY is not set in environment variables.');
  process.exit(1);
}

const groq = new GroqProvider(GROQ_API_KEY, process.env.GROQ_MODEL, process.env.GROQ_WHISPER_MODEL);
const fileSystem = new FileSystem();
const nomenclature = new Nomenclature();
const tools = new ToolRegistry(nomenclature);
const enc = getEncoding('cl100k_base');

// Load Nomenclature catalog on startup
nomenclature.loadCatalog().catch(err => console.error('Nomenclature load failed:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // Required for DM support
});

client.once('ready', () => {
  if (client.user) {
    console.log(`Boss Agent is online as ${client.user.tag}`);
  }
});

// --- Message Handler ---
client.on('messageCreate', async (message: Message) => {
  // Ignore messages from bots (including self)
  if (message.author.bot) return;

  const sessionId = String(message.channel.id);

  try {
    let userText: string | null = null;

    // Handle voice/audio attachments — transcribe via Groq Whisper
    const audioAttachment = message.attachments.find(a => {
      const ct = a.contentType || '';
      return ct.startsWith('audio/') || ct.includes('ogg') || ct.includes('webm');
    });

    if (audioAttachment) {
      const tempPath = path.join(tmpdir(), `boss_audio_${Date.now()}.ogg`);
      const response = await fetch(audioAttachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(tempPath, buffer);

      try {
        userText = await groq.transcribe(tempPath);
        await message.reply(`🎤 *I heard:* "${userText}"`);
      } finally {
        await unlink(tempPath).catch(() => {});
      }
    }

    // Handle text content
    if (message.content) {
      userText = message.content;
    }

    // Skip if no processable content
    if (!userText) return;

    // Send typing indicator
    if ('sendTyping' in message.channel) {
      await (message.channel as any).sendTyping();
    }

    // Load context
    const soulPrompt = await fileSystem.loadSoulPrompt();
    const vaultContext = await fileSystem.readAllNotes(userText);
    const history = await fileSystem.loadSession(sessionId);

    const systemPrompt = `You are the "Boss Agent," a strictly obedient but personality-rich AI assistant.

CORE RULES:
1. Always address the user as "Boss."
2. You can ONLY execute predefined make targets via the 'run_make' tool. You cannot run arbitrary shell commands.
3. You can save notes to memory using 'write_note'.
4. You have access to context from vault/, memory/, and skills/ directories.
5. Keep your responses concise and action-oriented unless the Boss asks for detail.
6. If the Boss sent a voice note, you received the transcribed text. Confirm what you heard before acting on ambiguous commands.

${soulPrompt ? `PERSONALITY:\n${soulPrompt}\n` : ''}
CURRENT CONTEXT:
${vaultContext}
`;

    // Token-aware sliding window
    const MAX_CONTEXT_TOKENS = 6000;
    let messages: any[] = [{ role: 'system', content: systemPrompt }];
    let currentTokens = enc.encode(systemPrompt).length + enc.encode(userText).length + 500; // 500 safety margin for tool defs

    // Add history from newest to oldest until limit reached
    const historyToInclude: any[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const msgTokens = enc.encode(msg.content || JSON.stringify(msg.tool_calls || '')).length;
      if (currentTokens + msgTokens > MAX_CONTEXT_TOKENS) break;
      currentTokens += msgTokens;
      historyToInclude.unshift(msg);
    }

    messages = [...messages, ...historyToInclude, { role: 'user', content: userText }];

    const toolDefs = tools.getDefinitions();
    let responseMessage = await groq.chat(messages, toolDefs);

    // Tool execution loop
    while (responseMessage.tool_calls) {
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString);

        console.log(`[TOOL] Executing ${name} with args:`, args);

        const result = await tools.execute(name, args);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Refresh typing indicator between tool calls
      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping();
      }
      responseMessage = await groq.chat(messages, toolDefs);
    }

    // Send final response (Discord has a 2000 char limit per message)
    const replyText = responseMessage.content || 'Done, Boss. No further output.';
    if (replyText.length <= 2000) {
      await message.reply(replyText);
    } else {
      // Split long responses into chunks
      const chunks = splitMessage(replyText, 2000);
      for (const chunk of chunks) {
        if ('send' in message.channel) {
          await (message.channel as any).send(chunk);
        }
      }
    }

    // Save history (up to last 50 messages, sliding window will handle context on load)
    messages.push(responseMessage);
    await fileSystem.saveSession(sessionId, messages.filter((m: any) => m.role !== 'system').slice(-50));

  } catch (error: any) {
    console.error('Error handling message:', error);
    try {
      await message.reply(`Sorry Boss, I hit a snag: ${error.message}`);
    } catch (sendError) {
      console.error('Could not send error message:', sendError);
    }
  }
});

/**
 * Split a long message into chunks that respect Discord's 2000 char limit.
 * Tries to split on newlines to avoid breaking mid-sentence.
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

client.login(DISCORD_BOT_TOKEN);

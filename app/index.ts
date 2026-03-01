import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Message } from 'discord.js';
import { writeFile, unlink, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { GroqProvider } from './lib/core/groq_provider.js';
import { FileSystem } from './lib/data/file_system.js';
import { ToolRegistry } from './lib/tools.js';
import { TokenTracker } from './lib/analytics/token_tracker.js';
import { getEncoding } from 'js-tiktoken';
import { Nomenclature } from './lib/utils/nomenclature.js';
import { TokenTruncationInterceptor } from './lib/interceptors/token_truncation.js';
import { MemoryCompressor } from './lib/services/compressor.js';
import { KairosEngine } from './lib/engine/kairos.js';

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

const groqModels = [
  process.env.GROQ_MODEL,
  process.env.GROQ_MODEL_2,
  process.env.GROQ_MODEL_3
].filter(Boolean) as string[];

const groq = new GroqProvider(GROQ_API_KEY, groqModels.length > 0 ? groqModels : undefined, process.env.GROQ_WHISPER_MODEL);
const fileSystem = new FileSystem();
const nomenclature = new Nomenclature();
const tokenTracker = new TokenTracker();
const tools = new ToolRegistry(fileSystem, nomenclature, tokenTracker);
tools.addInterceptor(new TokenTruncationInterceptor(tokenTracker));
const compressor = new MemoryCompressor(groq, fileSystem);
const enc = getEncoding('cl100k_base');

// --- Types ---
export interface NormalizedMessage {
  sessionId: string;
  authorId: string;
  authorTag: string;
  content: string;
  attachments?: { url: string; contentType?: string }[];
  reply: (content: string) => Promise<any>;
  send: (content: string) => Promise<any>;
  sendTyping?: () => Promise<void>;
}

// --- Lane Queue Management ---
const sessionQueues = new Map<string, Promise<void>>();

async function enqueueTask(sessionId: string, task: () => Promise<void>) {
  const previousTask = sessionQueues.get(sessionId) || Promise.resolve();
  const newTask = previousTask.then(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[QUEUE] Error in session ${sessionId}:`, err);
    }
  });
  sessionQueues.set(sessionId, newTask);
}

async function safeChat(msgs: any[], defs: any[]): Promise<any> {
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await groq.chat(msgs, defs);
    } catch (err: any) {
      if (err?.status === 400 && err?.error?.error?.code === 'tool_use_failed') {
        attempts++;
        console.warn(`[WARN] Model hallucinated tool call (attempt ${attempts}). Retrying...`);
        msgs.push({
          role: 'user',
          content: 'CRITICAL ERROR: Your previous response caused a "tool_use_failed" error. You MUST output strictly valid JSON matching the tool schema. Do NOT output raw markdown or text.'
        });
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded for tool calls.');
}

// Load Nomenclature catalog on startup
nomenclature.loadCatalog().catch((err: any) => console.error('Nomenclature load failed:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // Required for DM support
});

/**
 * Core reasoning and execution loop
 */
async function processMessage(message: NormalizedMessage) {
  const { sessionId } = message;

  try {
    let userText: string | null = null;

    // Handle voice/audio attachments — transcribe via Groq Whisper
    const audioAttachment = message.attachments?.find(a => {
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
    if (message.sendTyping) {
      await message.sendTyping();
    }

    // Load context
    const soulPrompt = await fileSystem.loadSoulPrompt();
    const fileIndex = await fileSystem.getFileSystemIndex();
    const history = await fileSystem.loadSession(sessionId);

    const systemPrompt = `You are the "Boss Agent," a strictly obedient but personality-rich AI assistant.

CORE RULES:
1. Always address the user as "Boss."
2. You can ONLY execute predefined make targets via the 'run_make' tool. You cannot run arbitrary shell commands.
3. You can save notes to memory using 'write_note'.
4. You have access to a lightweight index of files in vault/, memory/, and skills/ directories.
5. Use the 'read_memory' tool to fetch the full content of any file from the index if you need it to answer the Boss.
6. Keep your responses concise and action-oriented unless the Boss asks for detail.
7. If the Boss sent a voice note, you received the transcribed text. Confirm what you heard before acting on ambiguous commands.
8. If you receive a [SYSTEM: KAIROS_TICK] message, you are waking up autonomously. Review your current context (especially tasks in memory). If nothing requires attention, reply with exactly 'NO_ACTION_REQUIRED' to prevent spamming the chat. If action is needed, use your tools or send a proactive message.

${soulPrompt ? `PERSONALITY:\n${soulPrompt}\n` : ''}
AVAILABLE FILES:
${fileIndex}
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
    
    // Calculate and log context stats before sending request
    const currentModel = groqModels[0] || 'meta-llama/llama-4-scout-17b-16e-instruct';
    const contextStats = tokenTracker.calculateContextStats(
      systemPrompt,
      historyToInclude,
      userText,
      toolDefs,
      currentModel
    );
    
    console.log(`[TOKEN] Context: ${contextStats.currentContextTokens} tokens (${contextStats.percentOfContextWindow.toFixed(1)}% of ${tokenTracker.getModelLimits(currentModel).contextWindow})`);
    
    let responseMessage = await safeChat(messages, toolDefs);
    
    // Log the request for rate limit tracking
    tokenTracker.logRequest(contextStats.currentContextTokens);

    // Helper to parse inline hallucinated tool calls from fallback models
    const parseInlineToolCalls = (msg: any) => {
      if (!msg.content) return msg;
      
      const inlineToolCalls = [];
      let cleanedContent = msg.content;

      // Format 1: <function/name>json</function>
      const functionRegex1 = /<function\/([^>]+)>([\s\S]*?)<\/function>/g;
      let match;
      while ((match = functionRegex1.exec(msg.content)) !== null) {
        const name = match[1];
        const argsString = match[2].trim();
        
        try {
          JSON.parse(argsString);
          inlineToolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name,
              arguments: argsString
            }
          });
          cleanedContent = cleanedContent.replace(match[0], '').trim();
        } catch (e) {
          console.warn(`[WARN] Failed to parse inline tool call JSON for ${name}`);
        }
      }

      // Format 2: <function/name={...}> - extract balanced JSON
      const functionRegex2 = /<function\/([^=]+)=/g;
      while ((match = functionRegex2.exec(msg.content)) !== null) {
        const name = match[1];
        const startIdx = match.index + match[0].length;
        
        // Find balanced JSON starting from startIdx
        let depth = 0;
        let endIdx = startIdx;
        let foundStart = false;
        
        for (let i = startIdx; i < msg.content.length; i++) {
          const char = msg.content[i];
          if (char === '{') {
            depth++;
            foundStart = true;
          } else if (char === '}') {
            depth--;
            if (foundStart && depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        
        if (foundStart && depth === 0) {
          const argsString = msg.content.substring(startIdx, endIdx);
          try {
            JSON.parse(argsString);
            inlineToolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'function',
              function: {
                name,
                arguments: argsString
              }
            });
            const fullMatch = msg.content.substring(match.index, endIdx);
            cleanedContent = cleanedContent.replace(fullMatch, '').trim();
          } catch (e) {
            console.warn(`[WARN] Failed to parse inline tool call JSON for ${name}`);
          }
        }
      }

      if (inlineToolCalls.length > 0) {
        msg.tool_calls = (msg.tool_calls || []).concat(inlineToolCalls);
        msg.content = cleanedContent || null;
      }
      return msg;
    };

    responseMessage = parseInlineToolCalls(responseMessage);

    // Tool execution loop
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
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
      if (message.sendTyping) {
        await message.sendTyping();
      }
      responseMessage = await safeChat(messages, toolDefs);
      responseMessage = parseInlineToolCalls(responseMessage);
    }

    // Send final response (Discord has a 2000 char limit per message)
    const replyText = responseMessage.content || 'Done, Boss. No further output.';
    
    // Check for "NO_ACTION_REQUIRED"
    if (replyText.trim() === 'NO_ACTION_REQUIRED') {
      console.log(`[PROCESSOR] LLM requested silent output for session ${sessionId}.`);
    } else {
      if (replyText.length <= 2000) {
        await message.reply(replyText);
      } else {
        // Split long responses into chunks
        const chunks = splitMessage(replyText, 2000);
        for (const chunk of chunks) {
          await message.send(chunk);
        }
      }
    }

    // Save history (up to last 50 messages, sliding window will handle context on load)
    messages.push(responseMessage);
    
    // We want to exclude the initial system prompt from the history, 
    // but keep session summaries which also use the 'system' role.
    const updatedHistory = messages.filter((m: any, index: number) => {
      if (index === 0 && m.role === 'system') return false; // Skip the main system prompt
      return true;
    }).slice(-50);
    
    await fileSystem.saveSession(sessionId, updatedHistory);

    // Trigger background compression if limits are exceeded
    const historyTokens = updatedHistory.reduce((sum, m) => sum + enc.encode(m.content || JSON.stringify(m.tool_calls || '')).length, 0);
    if (updatedHistory.length > 20 || historyTokens > 4000) {
      console.log(`[COMPRESSOR] Session ${sessionId} history size (${updatedHistory.length} msgs, ${historyTokens} tokens) exceeded threshold. Compressing in background...`);
      compressor.compressSession(sessionId, updatedHistory).catch((err: any) => console.error(`[COMPRESSOR] Error in background compression:`, err));
    }

  } catch (error: any) {
    console.error('Error handling message:', error);
    try {
      await message.reply(`Sorry Boss, I hit a snag: ${error.message}`);
    } catch (sendError) {
      console.error('Could not send error message:', sendError);
    }
  }
}

// --- Kairos Engine Initialization ---
const kairos = new KairosEngine(async (tickMsg) => {
  // Discover active sessions by reading session_history/
  const sessionDir = './session_history';
  try {
    const files = await readdir(sessionDir);
    const sessionIds = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));

    console.log(`[KAIROS] Firing tick for ${sessionIds.length} sessions.`);
    
    for (const sessionId of sessionIds) {
      // Map the generic tick message to a specific session
      const sessionMsg: NormalizedMessage = {
        ...tickMsg,
        sessionId,
        reply: async (content) => {
          try {
            const channel = await client.channels.fetch(sessionId);
            if (channel && 'send' in channel) {
              return await (channel as any).send(content);
            }
          } catch (err) {
            console.error(`[KAIROS] Failed to send reply to session ${sessionId}:`, err);
          }
        },
        send: async (content) => {
          try {
            const channel = await client.channels.fetch(sessionId);
            if (channel && 'send' in channel) {
              return await (channel as any).send(content);
            }
          } catch (err) {
            console.error(`[KAIROS] Failed to send to session ${sessionId}:`, err);
          }
        },
        sendTyping: async () => {
          try {
            const channel = await client.channels.fetch(sessionId);
            if (channel && 'sendTyping' in channel) {
              await (channel as any).sendTyping();
            }
          } catch {}
        }
      };

      enqueueTask(sessionId, () => processMessage(sessionMsg));
    }
  } catch (err) {
    console.error(`[KAIROS] Error discovering sessions:`, err);
  }
});

// --- Message Handler ---
client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  const sessionId = String(message.channel.id);

  const normalized: NormalizedMessage = {
    sessionId,
    authorId: message.author.id,
    authorTag: message.author.tag,
    content: message.content,
    attachments: message.attachments.map(a => ({ url: a.url, contentType: a.contentType || undefined })),
    reply: (content: string) => message.reply(content),
    send: (content: string) => message.channel.send(content),
    sendTyping: () => (message.channel as any).sendTyping?.()
  };

  enqueueTask(sessionId, () => processMessage(normalized));
});

client.once('ready', () => {
  if (client.user) {
    console.log(`Boss Agent is online as ${client.user.tag}`);
    kairos.start();
  }
});

/**
 * Split a long message into chunks that respect Discord's 2000 char limit.
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

import { createInterface } from 'readline';
import type { NormalizedMessage } from '../../index.js';
import { log } from '../utils/logger.js';

/**
 * Terminal adapter for boss-agent interaction
 * Allows users to interact with boss-agent through stdin/stdout instead of Discord
 */
export class TerminalAdapter {
  private sessionId: string;
  private messageHandler: (message: NormalizedMessage) => Promise<void>;
  private rl: any;

  constructor(sessionId: string, messageHandler: (message: NormalizedMessage) => Promise<void>) {
    this.sessionId = sessionId;
    this.messageHandler = messageHandler;
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Start the terminal adapter
   */
  start(): void {
    log('[TERMINAL] Starting terminal adapter...');
    console.log('\n=== Boss Agent Terminal Interface ===');
    console.log('Type your messages and press Enter to send.');
    console.log('Type "exit" or "quit" to exit.\n');

    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      if (trimmed === 'exit' || trimmed === 'quit') {
        this.stop();
        return;
      }

      if (!trimmed) {
        return;
      }

      // Log incoming user message to terminal
      console.log(`\n[USER] TerminalUser: ${trimmed}\n`);

      // Create a normalized message for terminal input
      const message: NormalizedMessage = {
        sessionId: this.sessionId,
        authorId: 'terminal-user',
        authorTag: 'TerminalUser',
        content: trimmed,
        reply: async (content: string) => {
          console.log(`\n[BOSS]: ${content}\n`);
        },
        send: async (content: string) => {
          console.log(`\n[BOSS]: ${content}\n`);
        },
        sendTyping: async () => {
          // Terminal doesn't support typing indicators
        }
      };

      // Send the message to the message handler
      try {
        await this.messageHandler(message);
      } catch (error: any) {
        console.error(`[ERROR] Failed to process message: ${error.message}`);
      }

      // Show prompt again
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      log('[TERMINAL] Terminal adapter closed.');
      process.exit(0);
    });

    // Show initial prompt
    this.rl.setPrompt('Boss> ');
    this.rl.prompt();
  }

  /**
   * Stop the terminal adapter
   */
  stop(): void {
    log('[TERMINAL] Stopping terminal adapter...');
    this.rl.close();
  }

  /**
   * Send a message to the terminal (for proactive messages from the agent)
   */
  sendMessage(content: string): void {
    console.log(`\n[BOSS]: ${content}\n`);
    this.rl.prompt();
  }
}
